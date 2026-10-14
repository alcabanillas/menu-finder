## Context

See proposal.md, "Why". The current state:

- `searchByText` (`src/application/use-cases/search/search-by-text.ts`) chains `decomposeText` and `findMenus` and is called only by `cli-container.ts`. `web-container.ts` builds its dependencies lazily from `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, all three required on the first call.
- `RateLimiter` (`src/application/ports/rate-limiter.ts`) with `PostgresRateLimiter` is used only by `signIn`. Its `hit(key, { limit, windowSeconds })` increments atomically and answers `allowed`.
- SEG-rate-limit (`context/decisiones.md`) puts the LLM limit **in the web adapter, not in the use case**, so the CLI never consumes it (decided by the author on 2026-10-11).
- `findMenus` folds an embedding failure into `search-failed` (`semanticScores`), so its kind is lost.
- Sentry runs on the server with `instrumentation.ts`, errors only and `dataCollection` off (spec `error-reporting`). `Result` failures never reach it.

## Goals / Non-Goals

**Goals:**
- A server-side entry point that MF-22.4's server action can call with the request text and get a `Result`.
- The daily limit and the Sentry report around it, both tested without a browser.

**Non-Goals:**
- The session check and the server action: MF-22.4. This change adds no endpoint, so it adds no authorization surface.
- Reporting `invalid-answer`, the case in which the model answers outside its contract: its issues hold terms the model wrote, which may echo the request. It is a quality signal for the evaluation, not an operational fault.
- A per-user limit (SEG-rate-limit: not with two accounts).

## Decisions

### D1. The web calls a variant of the use case with the limit and the report

`src/application/use-cases/search/search-by-text.ts` exports two entry points over one private `runSearch`:
- `searchByText(request, strategy, deps)`, the CLI's, with no limit and no report.
- `searchByTextWithinDailyLimit(request, strategy, deps)`, the web's: first one hit on the daily bucket, then `runSearch`, then the report of a failed outcome. Its extra dependencies are `rateLimiter`, `failureReport`, `now`, `dailyLimit`, `decomposerModel` and `secrets`.

`src/composition/web/search-deps.ts` only wires: it reads `LLM_DAILY_LIMIT`, builds the adapters and passes them in (ADR-001 §3, "composition solo cablea").

- **Why:** SEG-rate-limit applies the limit only in the web, so the CLI calls the variant without it, with no flag and no stub. The limit and the report are application logic, so they are tested with fakes like `signIn`, not inside the composition root.
- **Alternative rejected:** a `RateLimiter` dependency inside `searchByText`, with an unlimited stub for the CLI. It adds a fake adapter to the CLI only to switch it off.
- **Alternative rejected:** a decorator of the `RequestDecomposer` port. It fits the limit, but the report needs the outcome of the whole search, so it would spread over three ports or force a reporter on the CLI.
- **Alternative rejected:** the limit and the report as functions in `src/composition/`, the first version of this change. It puts logic in the composition root.

### D2. One web search is one invocation, counted before the decomposer

A search makes two Gemini calls: the decomposer, and the embedding of the terms (one batch, `semantic` strategy). The limit counts **searches**: 100 a day means 100 searches. Counting each call would make the limit depend on the strategy and on the number of terms, which the user cannot see. The hit is recorded before any call. A request that `decomposeText` refuses for its length also spends one hit: checking the length first would copy a rule of the use case into the adapter, for a case that costs nothing to Gemini and that the UI prevents with `maxLength`.

### D3. The daily bucket key carries the UTC date

The key is `llm:daily:<YYYY-MM-DD>` in UTC, with a window of 86,400 seconds, so the counter rolls over at midnight UTC as spec `rate-limiting` says, whatever time the first search of the day ran. The current instant is a parameter (`now: () => Date`), so the rollover is tested without a fake timer. The `Clock` port is not used, because it gives the Europe/Madrid date and the spec counts in UTC.

`LLM_DAILY_LIMIT` is read once, by `src/composition/web/search-deps.ts`, when the search's dependencies are built. A value that is not a positive integer falls back to 100.

### D4. `embedding-failed` becomes a kind of `SearchMenusError`

`semanticScores` returns `{ kind: 'embedding-failed', reason }` when `embedQueries` fails. The vector-count mismatch and the store errors stay `search-failed`. The type already exists in `EmbeddingError`, so `SearchMenusError` adds that member. Its callers, all three exhaustive switches, then cover it:
- `cli/commands/search.ts` and `cli/commands/search-text.ts` print `The embedding service failed: <reason>`.
- `evaluate-search.ts` maps it to its existing `search-failed` row, so the committed report keeps its shape.

### D5. The event: a message with tags, through `@sentry/nextjs`

A failed outcome is not an `Error`, so it is sent with `Sentry.captureMessage('search failure: <kind>', { level, tags, extra })`:
- `tags.failure`: the kind, so that Sentry groups and filters by it.
- `tags.model`: the decomposer or embedding model, read from the adapter's `model` field.
- `extra.reason`: the reason, passed through `redactSecrets(reason, [apiKey, request])`.

The level is `error` for the faults (`decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded`) and `warning` for `llm-limit-reached`, which is the system working as designed.

The user outcomes give no event, through the `default` branch of `toEvent`. `invalid-request` is one of them, but `searchByTextWithinDailyLimit` cannot reach it: `decomposeText` checks the structure with the same `parseSearchRequest` that `findMenus` uses and returns a failure as `invalid-answer`, and an empty structure stops at `nothing-to-search` before `findMenus`. So the test of "User outcomes not reported" covers the other five kinds, and `invalid-request` relies on the `default` branch.

The sender is `src/infrastructure/sentry/sentry-search-failure-report.ts`, behind the port `SearchFailureReport` (`src/application/ports/search-failure-report.ts`): the use case calls it (D1), and monitoring is an external boundary that no existing port covers. The use case builds the event and redacts the reason, so the adapter only sends it. `dataCollection` already keeps the request out of the event, and the server's `beforeSend` is not touched.

- **Alternative rejected:** `captureException(new Error(...))`, which adds a stack trace of the reporter that says nothing about the fault.

### D6. `GEMINI_API_KEY` is required only by the search

`REQUIRED` stays as it is. The search builds its Genkit adapters on its first call and checks `GEMINI_API_KEY` then: a missing key throws `Missing environment variables: GEMINI_API_KEY` from that call only, so login, `/menu` and `/shopping-list` keep working without it. The throw is uncaught, so `onRequestError` reports it as today. The search runs over the same pool as the rest of the web (pooled `DATABASE_URL`, ADR-001 §5), with the `semantic` strategy, the default of the CLI (MF-22.1).

## Risks / Trade-offs

- [A Gemini or PostgreSQL message may quote a term of the request that is not the whole request] → `redactSecrets` removes the whole request only. Gemini errors seen so far (MF-40.3) are status codes and quotas, with no echo of the input. Residual risk, accepted for the MVP.
- [After the limit is reached, every search sends one `warning` event] → Spike Protection and the monthly quota of the free plan bound it (MF-22.2), and only signed-in users reach the entry point (MF-22.4).
- [The pooled connection and a two-call search run inside a serverless function's time limit] → the decomposer has its own 20 s timeout (MF-40.2); the worst case is MF-60's.
- [Counting searches, not calls, lets a long request embed up to 12 terms for one hit] → one batch call, bounded by the 12 constraints of spec `menu-search`.

## Migration Plan

Add `GEMINI_API_KEY` to the Vercel production variables before the release that ships MF-22.4: without it the search fails and nothing else does. `LLM_DAILY_LIMIT` is optional. No migration: `rate_limit_bucket` exists since MF-21. Rollback is a revert: nothing calls the entry point until MF-22.4.
