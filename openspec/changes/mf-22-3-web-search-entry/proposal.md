## Why

Roadmap item **MF-22.3** (`context/roadmap.md`). The web cannot search yet: `searchByText` is wired only to the CLI (`src/composition/cli-container.ts`), the global daily LLM limit of spec `rate-limiting` is enforced nowhere, because SEG-rate-limit applies it only in the web and the web has no search yet, and the typed failures of the Genkit adapters (`decomposer-failed`, `embedding-failed`) are returned as `Result` values, which Sentry never sees. MF-22.4 builds the `/planner` screen on top of this entry point, so the entry point, its limit and its failure reports come first and are tested without UI.

## What Changes

- The web container gets a search entry point, `searchByText(request)`, which runs the existing `searchByText` use case with the `semantic` strategy over the pooled `DATABASE_URL`, `GEMINI_API_KEY` read only when a search runs.
- Before any call to the model, the entry point records one hit in the global daily LLM bucket through the existing `RateLimiter` port. Over the limit (100 per UTC day by default, `LLM_DAILY_LIMIT` to override), it returns `llm-limit-reached` and calls neither Gemini nor the search.
- The search keeps the kind of an embedding failure: `findMenus` returns `embedding-failed` instead of folding it into `search-failed`, so the report and the CLI can tell them apart.
- The web entry point reports the system failures of a search to Sentry: `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` and `llm-limit-reached`. Each event has the kind and, where there is one, the model. It also has the reason, with the API key and the request text removed. The request text itself, the structure and the terms are never sent. The user's outcomes (a rejection, a request that is too short or too long, an invalid answer, nothing to search) are not failures of the system and are not reported.
- No HTTP endpoint and no server action: the session check happens in the server action of MF-22.4, which calls this entry point only for a signed-in user.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `rate-limiting`: the global daily LLM limit says what counts as one invocation (one web search), where it applies (the web, not the CLI, as SEG-rate-limit decides) and what the caller gets when it is reached.
- `error-reporting`: new requirement. The system failures of a web search reach Sentry explicitly, with no request data.
- `menu-search`: a failure of the embedding service is reported as `embedding-failed`, not as `search-failed`.

## Impact

- **Code:** `src/application/use-cases/search/search-by-text.ts` (the web variant `searchByTextWithinDailyLimit`, with the daily limit and the report), the port `src/application/ports/search-failure-report.ts` and its Sentry adapter in `src/infrastructure/sentry/`, `src/composition/web-container.ts` (wiring only; the client IP of the sign-in moves to `src/infrastructure/http/`, a refactor with no behavior change), `src/application/services/search/find-menus.ts` and `src/application/dto/search-result.ts` (the `embedding-failed` kind), `src/cli/commands/search.ts` and `search-text.ts` (print the new kind).
- **Configuration:** `GEMINI_API_KEY` becomes a Vercel variable of the web, read lazily, so login and `/menu` keep working without it. `LLM_DAILY_LIMIT` is optional.
- **Data touched:** the request text of the user (never stored, never sent to Sentry), the `rate_limit_bucket` table (one row per UTC day, no user data), and the error reasons of Genkit and PostgreSQL.
- **Abuse:** a signed-in user who spams searches to drain the Gemini credits is stopped by the daily limit. Repeated searches once the limit is reached send one Sentry event each, which Spike Protection and the monthly quota bound (MF-22.2). A Gemini error message that echoes the prompt would leak the request, so the reason is redacted of the request text. The key would leak the account, so it is redacted too, as the adapters already do.
- **OWASP:** A04 Insecure Design (unbounded consumption of the LLM), A09 Security Logging and Monitoring Failures (failures that never reach monitoring), A02 / A09 sensitive data in logs (request text and key kept out of Sentry).
- **Decisions relied on:** SEG-rate-limit (limit only in the web, `RateLimiter` port in Neon), OPS-observabilidad (errors only, no request data), SEG-datos-nutricionista, BUS-descomponedor, IA-proveedor. It contradicts none. The `rate-limiting` spec spoke of "LLM invocations" without saying a web search makes two Gemini calls; counting the search as one is decided in design.md.
