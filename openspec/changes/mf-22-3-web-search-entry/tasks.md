## 1. `embedding-failed` in the search

- [x] 1.1 RED: in `src/application/services/search/find-menus.test.ts`, write "Embedding service fails" (`semantic`, `embedQueries` fails → `embedding-failed` with its reason, no ranking) and keep "Database unreachable" as `search-failed`. See the first fail
- [x] 1.2 GREEN: add `embedding-failed` to `SearchMenusError` and return it from `semanticScores` (design D4). Verify 1.1 passes and `pnpm typecheck` points to the three exhaustive switches
- [x] 1.3 RED: in `src/cli/commands/search.test.ts` and `search-text.test.ts`, a test that `embedding-failed` prints `The embedding service failed: <reason>` with exit code 1; in `src/application/use-cases/evaluation/evaluate-search.test.ts`, a test that it becomes the `search-failed` row. See them fail
- [x] 1.4 GREEN: add the cases to `cli/commands/search.ts`, `cli/commands/search-text.ts` and `evaluate-search.ts`. Verify 1.3 passes and `pnpm typecheck` is clean

## 2. Daily LLM limit

- [x] 2.1 RED: in `src/application/use-cases/search/search-by-text.test.ts`, for `searchByTextWithinDailyLimit` with a fake `RateLimiter` and a fixed `now`, write "LLM call permitted under daily limit" (one hit on `llm:daily:<UTC date>`, window 86,400 s), "LLM call rejected when daily limit is reached" (`llm-limit-reached`), "Daily counter rolls over on a new day" (23:59 UTC on the 13th and 00:01 UTC on the 14th give two different keys), "Limit overridden by configuration" and, in `src/composition/web-container.test.ts`, "Invalid limit configuration" (`0`, `-5`, `abc`, unset → 100). See them fail
- [x] 2.2 GREEN: write `searchByTextWithinDailyLimit` over a private `runSearch` shared with `searchByText`, and read `LLM_DAILY_LIMIT` in `web-container.ts` (design D2, D3). Verify 2.1 passes

## 3. Failure report

- [x] 3.1 RED: in `src/application/use-cases/search/search-by-text.test.ts`, with a fake `SearchFailureReport`, write "Decomposer failure reported", "Embedding failure reported", "Database failure reported", "Index not loaded reported", "Daily limit reported" (kind, model where it applies, level `error` or `warning`), "Key and request removed from the reason", "User outcomes not reported" (each of the six kinds) and "Successful search not reported". See them fail
- [x] 3.2 GREEN: add the port `SearchFailureReport` and the report step of `searchByTextWithinDailyLimit` (design D1, D5). Verify 3.1 passes
- [x] 3.3 RED: in `src/infrastructure/sentry/sentry-search-failure-report.test.ts`, with `@sentry/nextjs` mocked, a test that one event becomes one `captureMessage('search failure: <kind>', …)` with `tags.failure`, `tags.model`, `extra.reason` and the level. See it fail
- [x] 3.4 GREEN: write `src/infrastructure/sentry/sentry-search-failure-report.ts`. Verify 3.3 passes and `pnpm lint` accepts its imports (ESLint boundaries)

## 4. Web entry point

- [x] 4.1 RED: in `src/composition/web-container.test.ts`, with fake adapters, write that `searchByText(request)` hits the limit before the decomposer, returns `llm-limit-reached` with no decomposer, embedding or search call, runs the `semantic` search when allowed, reports a `decomposer-failed` outcome once and returns it unchanged, and that a missing `GEMINI_API_KEY` rejects only the search with the variable named and never its value, while `signIn` still works. Also, in `src/composition/cli-container.test.ts`, "CLI not limited": `search-text` records no hit. See them fail
- [x] 4.2 GREEN: wire `searchByTextWithinDailyLimit` in `src/composition/web-container.ts` (design D1, D6), wiring only: Genkit adapters built on the first search, the pool and `PostgresRateLimiter` reused, the Sentry reporter injected. Verify 4.1 passes and the existing web-container tests pass unchanged

## 4b. Refactor: composition only wires

- [x] 4b.1 Move the client IP of the sign-in out of `web-container.ts` into `src/infrastructure/http/forwarded-client-ip.ts`, which receives the injected request headers like `BetterAuthSessionManager`; the existing web-container test now checks the IP in the rate-limit key. Restrict `next/headers` to `web-container.ts` with ESLint (ADR-001 §5). No behavior change (PROC-sdd, small refactor)

## 5. Close

- [x] 5.1 Update `context/roadmap.md` MF-22.3 with this scope (web entry point, daily limit, failures to Sentry, ~2 h) and MF-22.4 (the server action checks the session and calls it); add `GEMINI_API_KEY` and `LLM_DAILY_LIMIT` to the variables table in `context/despliegue.md` if it lists them. Verify both read as decided
- [x] 5.2 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:coverage`, and verify all pass with the coverage thresholds of OPS-calidad
- [x] 5.3 Before archive, go through `context/safety-first.md` §4 and record the result in this file


### Result of 5.3: `context/safety-first.md` §4

- Business and security decisions in the backend: yes. The daily limit and the report live in `searchByTextWithinDailyLimit`, the web's use case; the browser decides nothing.
- Endpoint auth, permissions and input shape; user from the session; negative authorization tests: **not applicable here, by design.** This change adds no endpoint and no server action (proposal, "What Changes"). MF-22.4's server action checks the session and must bring those tests. Until then nothing calls `searchByText`.
- Minimum data returned: yes. The outcome is the `TextSearchDto` or an error kind; no key, no connection string.
- No secret in the diff: yes. `GEMINI_API_KEY` is read from the environment; the tests use a made-up key.
- New dependencies: none.
- Parameterized queries: yes. No new SQL; the rate limiter, menu, dish and embedding adapters are the existing ones.
- Unexpected inputs and prompt injection: the request text goes through `decomposeText` unchanged, so its tests (empty, over-length, rejection, invalid answers) apply as they are. This change adds no new parsing of the text. Tests added: `llmDailyLimit` with `0`, `-5`, `abc`, `1.5`, empty and unset; the report with the key and the request inside the reason.
- Sensitive action logged with who, what and when: **partial.** `llm-limit-reached` and every system failure reach Sentry with kind, model and reason, with no user data. They are not written to the `AuditLog` with a user id, because this entry point has no session yet. MF-22.4 passes the user id and decides whether the audit log records it.
- Deviation from a DEBE rule: none beyond the two items above, which are left to MF-22.4 on purpose.