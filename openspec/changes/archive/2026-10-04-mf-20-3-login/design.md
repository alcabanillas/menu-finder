## Context

See `proposal.md` for the motivation. What exists and constrains the approach (read from the code, 2026-10-04):

- **`infrastructure/auth/create-auth.ts`** builds the closed setup (`createAuth({ pool, secret, baseUrl })`); `auth-options.ts` holds the shared settings (7-day session, 1-day renewal, password limits, no telemetry). `create-account.ts` builds the open setup, and an ESLint rule already forbids `src/composition/web-container.ts` from importing it (`account-creation-boundary.test.ts`). `web-container.ts` does not exist yet.
- **`app/` may import** only `composition/web-container`, `application` dto and use cases, `features`, `shared` (ADR-001 §3, ESLint `boundaries`). A Server Component calls use cases through the container, never the library (ADR-001 §5).
- **Existing ports read for this design** (`src/application/ports/`): `AccountCreator`, `DishTextSearch`, `DocumentSource`, `EmbeddingsPort`, `MenuRepository`, `MigrationRunner`, `RecipeEmbeddingRepository`, `RecipeRepository`, `RepositoryError`. `AccountCreator` creates accounts; none signs in, reads or ends a session, and none writes a log.
- **Library facts checked in `better-auth` 1.7.6:** `better-auth/next-js` exports `toNextJsHandler` (route handler) and `nextCookies` (plugin that lets server calls set cookies inside server actions). The rate limiter and the origin check run only in the HTTP router (`dist/api/index.mjs`, `onRequest`), not in `auth.api.*` calls. `getSession` returns `null` with no database query when there is no cookie or its signature is wrong (`dist/api/routes/session.mjs`). The cookie is `SameSite=Lax` by default (`dist/cookies/index.mjs`).
- **Next.js 16** (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`): check the session close to the data, in the page or a data-access function, not in a layout (layouts do not re-run on navigation); `proxy.ts` is optional and only for optimistic cookie checks.
- **Env:** the web uses the pooled `DATABASE_URL` (ADR-001 §5), `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` (MF-20.1 D4). CI has no database and no secret today; `pnpm test:e2e` runs against `pnpm start` there.

## Goals / Non-Goals

**Goals:**
- Sign in, sign out and a server-checked protected route, end to end in the browser.
- The first `web-container.ts`, with the shape ADR-001 §5 fixes, so MF-43 only adds use cases to it.
- The sign-in log that MF-20.1 deferred.

**Non-Goals:**
- Rate limiting the sign-in (MF-21; D1 decides how it will be done).
- The real `/planner` and the dashboard on `/` (MF-43, MF-22 and later).
- An optimistic `proxy.ts` check: every protected page checks on the server, and there is one protected page.
- Sending the log to Sentry or alerting on it (MF-32).
- Ownership checks on user data (MF-43, the first per-user data).

## Decisions

**Status:** D1 is **decided by the author (2026-10-04): option (b)**. D2 to D7 are **decided by the author (2026-10-04)**: D3 to D7 one by one, D2 by approving the plan. Nothing goes to `context/decisiones.md` before the closing task.

### D1. How the web reaches the authentication

**Decided by the author (2026-10-04): (b), server actions only.**

| Option | What it is | For | Against |
|---|---|---|---|
| (a) HTTP handler | Mount `toNextJsHandler(auth)` at `src/app/api/auth/[...all]/route.ts`; the form posts through a server action that calls the same library | The library's own rate limiter and origin check run on every HTTP call; SEG-rate-limit and MF-21 stay as decided (`storage: "database"`) | Every library endpoint becomes public (`sign-up` refused, but also `update-user`, `change-password`, `list-sessions`, `revoke-sessions`…), so the surface must be trimmed with `disabledPaths` and kept trimmed on upgrades |
| (b) Server actions only | No route handler. Sign-in and sign-out are server actions that call `auth.api.*` with the `nextCookies` plugin; pages read the session with `auth.api.getSession` | Smallest surface: no auth endpoint exists, the closed sign-up cannot even be reached (SEG-sistema-cerrado, "reducción de superficie"); Next.js checks `Origin` on server actions | The library's rate limiter never runs: MF-21 must limit sign-in with its own counter behind the `RateLimiter` port SEG-rate-limit already plans for the LLM, and SEG-rate-limit changes |

**Why (b).** The system is closed by design and has two accounts; exposing a dozen library endpoints to get one rate limiter is the worse trade. MF-21 already builds a database counter behind `RateLimiter` for the LLM cap, and counting failed sign-ins per IP on the same port is a small addition. The cost is real and lands on MF-21 (estimate up by about 0.5 h) and on the text of SEG-rate-limit, which the author must approve.

Consequences: no `src/app/api/auth/` route exists, and a test checks that `/api/auth/sign-up/email` and `/api/auth/sign-in/email` answer 404. The `nextCookies` plugin goes into the closed setup only (`create-auth.ts`), not into `authOptions`, so the CLI setup does not change. SEG-rate-limit and the MF-21 entry in `context/roadmap.md` are updated in the closing task.

### D2. A new port, `SessionManager`

```ts
interface SessionManager {
  signIn(credentials: Credentials): Promise<Result<SignedInUser, SignInError>>;
  signOut(): Promise<{ userId: string | null }>;
  current(): Promise<SignedInUser | null>;
}
```

`SignedInUser` is `{ userId, name }`, the minimum the pages need (safety-first §2.2: no full model). `SignInError` is `wrong-credentials` or `failed`. The adapter, `BetterAuthSessionManager` in `infrastructure/auth/`, reads and writes the cookies of the current request through `next/headers` (an external library, allowed in `infrastructure`), so the port carries no HTTP type. Why no existing port fits: `AccountCreator` creates accounts with the open setup and must stay out of the web; the others move menus, recipes, embeddings, documents and migrations. Named by the domain concept (session), not by the library.

Found while implementing 3.3: `nextCookies` imports `next/headers` itself, and Vitest loads `node_modules` untransformed, so a test's mock did not reach the plugin and no cookie was written. The `unit` project of `vitest.config.mts` now inlines `better-auth` (`server.deps.inline`); the whole suite still passes (598 tests). The adapter tests replace `next/headers` with an in-memory cookie jar. The email and password limits (254, 128) are declared again in the port, because `application` cannot import the copies in `infrastructure/auth/`; unifying them is left out of this change.

Alternative: the container exposes the library calls with no port or use case. Rejected: ADR-001 §5 makes pages call use cases, and the validation and the log below would have nowhere to live.

### D3. Use cases: `signIn`, `signOut`, `currentUser`

- `signIn({ sessions, auditLog }, input)` normalises the email (NFC, trim), validates `{ email, password }` with a Zod schema (text, non-empty, at most 254 and 128 characters), calls the port, logs the outcome and returns `Result<SignedInUser, SignInFailure>` where `SignInFailure` is `email-required`, `password-required` or `wrong-credentials`. Invalid shape or length maps to `wrong-credentials` so the answer does not tell which rule failed (spec "The sign-in input is validated on the server"); the log keeps the class `invalid-input`. A fault of the port (database down) returns `failed`, which is not logged as a refusal; the page shows a generic "try again" message (added while implementing 2.3).
- `signOut({ sessions, auditLog })` calls the port and logs with the user id it returns (none when there was no session).
- `currentUser({ sessions })` returns the port's answer. It exists so pages depend on a use case, as ADR-001 §5 asks, and is where MF-43 can add checks later. Alternative: the container exposes `sessions.current()` with no use case. Rejected by the author: it saves one pass-through file but breaks the letter of ADR-001 §5, which would need a written exception.

Zod is already a dependency (`^4.6.5`); `application` may import external libraries (ESLint allows them everywhere except `domain`).

### D4. A new port, `AuditLog`

`record(event: AuditEvent): void`, with `AuditEvent` = `{ type: 'sign-in' | 'sign-in-refused' | 'sign-out', userId?: string, reason?: 'wrong-credentials' | 'invalid-input', at: Date }`. The adapter `StdoutAuditLog` in `infrastructure/logging/` writes one JSON line to `process.stdout` (Vercel keeps function output; `console.info` is forbidden by the ESLint config). The type has no field for an email, a password or a token, so the spec's "never in the log" holds by construction, and a test checks the written line. Why a port: the log is an external sink, and MF-32 adds a Sentry adapter (alone, or beside this one in the way `infrastructure/fan-out/` already does for repositories) without touching the use cases; since the event type has no email, password or token, none can reach Sentry either. No existing port writes events.

Alternative: the adapter of D2 logs. Rejected: the refused-for-invalid-input case never reaches the adapter.

### D5. `web-container.ts`

`src/composition/web-container.ts` exports the three use cases already bound (`signIn(input)`, `signOut()`, `currentUser()`). It builds the pool from `DATABASE_URL` and the closed setup from `createAuth` once, cached on `globalThis` so hot reload does not multiply pools (ADR-001 §5). A missing variable throws an error that names it, never its value, at the first call, not at import, so `next build` does not need a database. Client components live in `features/`, which ESLint already forbids to import `composition`; the `server-only` package is not added (it is not installed, and the proposal adds no dependency).

### D6. Where the session is checked

A helper in `src/app/_session/require-user.ts` (`_` keeps it out of the routes) calls `currentUser()` and `redirect('/login')` when it is `null`. Every protected page calls it first, before reading anything; `/planner` is the only one now. Not in a layout (Next.js guide). Because "every route other than `/` and `/login` is protected" is easy to forget, a test lists every `page.tsx` under `src/app/` and fails if one outside that pair does not call `requireUser` — the same idea as the boundary test of MF-20.1: a rule nobody checks gets broken.

Alternative: a React context with the user, provided from a layout. Rejected as a protection: it lives in the client and in a layout, which does not re-run on navigation nor stop child segments from rendering (Next.js guide; safety-first P5). As a way to show the user in client components it is fine, passing the already-checked user to a provider; it is added when the first client component needs the user (MF-43 or MF-22), not now.

### D7. UI: `features/auth/`

`LoginForm` (client component, `useActionState`) and `SignOutButton` (a form with a server action) live in `src/features/auth/` (Scope Rule, ADR-001 §2). They receive the server action by props and only render; they are tested with Testing Library and a fake action. `app/login/actions.ts` and a shared sign-out action in `app/_session/` call the container and redirect. UI text in Spanish (es-ES), following the author's design system ("Menu Finder Design System", Content fundamentals: informal *tú*, sentence case, no exclamation marks or emoji); `<html lang>` becomes `es`. Styling is plain Tailwind: the design system's tokens, font and components come in MF-47, which restyles these two components.

## Risks / Trade-offs

- **[The cookie is not renewed when the session is only read in a Server Component]** → Server Components cannot set cookies. When `getSession` renews the session after 1 day, the row in the database moves 7 days forward but the browser cookie may keep its first expiry, so the sliding window of SEG-auth would end 7 days after sign-in. Task 1.2 checks it (timebox 20 minutes) by reading `Set-Cookie` after a renewal. If it breaks, the options go to the author: renew in a server action or route handler, or accept a fixed 7-day cookie and say so in SEG-auth.

  **Result of task 1.2 (2026-10-04, read from `better-auth` 1.7.6, no browser run needed):** it breaks. `nextCookies` (`dist/integrations/next-js.mjs`) marks a request with `RSC: 1` and no `next-action` (a client-side navigation) to skip the session refresh, so neither the row nor the cookie moves. On a full page load there is no `RSC` header: `getSession` (`dist/api/routes/session.mjs`) moves `expires_at` in the database, and the plugin's `cookies().set` throws inside the Server Component and is swallowed (`catch {}`), so the cookie keeps its first expiry. Only a server action renews both, and this change has only sign-in and sign-out. In the web, a session therefore ends 7 days after sign-in, not 7 days after the last use.

  **Decided by the author (2026-10-04): accept it (option A).** With two accounts, signing in once a week costs nothing, and the plugin keeps the row and the cookie in step. Rejected: renewing the cookie in `proxy.ts` (option B), one more database read per navigation and cookie handling of our own in a file the Next.js guide wants light, for a benefit nobody would notice here. SEG-auth says so in the closing task (6.1).
- **[CI needs env to start the app]** → the workflow sets a random `BETTER_AUTH_SECRET` per run and a dummy `DATABASE_URL`; the "no session" and "forged cookie" tests never reach the database (checked in the library code), so they pass with it. The sign-in end-to-end test is skipped when `DATABASE_URL_TEST` is absent, like the integration tests, until MF-44.
- **[D1 (b) leaves sign-in without a limit until MF-21]** → acceptable for a closed system with no public URL yet; MF-46 (production) comes after MF-21 in the roadmap. The roadmap entry of MF-21 is updated in the closing task.
- **[The page test of D6 is a static check]** → it reads source files, so a page that calls the check through another name passes or fails wrongly. Accepted: one helper, one name.

## Migration Plan

No new migration: the tables are those of MF-20.1. `production` does not have them yet (MF-46), and the development branch of MF-20.1 no longer exists, so task 1.1 creates the Neon branch `mf-20-3-login` from `production`, applies `002-auth-schema.sql` there with `pnpm ingest migrate`, creates an account with `pnpm ingest account`, and points the worktree's `.env.local` at it, with `BETTER_AUTH_URL=http://localhost:3000`. The integration tests keep using the `test` branch through `DATABASE_URL_TEST`, with their own migrated schema per file. The branch is deleted after the archive; production gets the tables and variables in MF-46.

## Open Questions

- None. D1 is decided; task 1.2 may raise the cookie question of the first risk.
