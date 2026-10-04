## Why

Roadmap item **MF-20.3**, the last of the three subtasks of MF-20 (after `mf-20-1-auth-server` and `mf-20-2-cli-create-account`). Accounts, passwords and sessions exist on the server and the CLI creates accounts, but nobody can sign in from a browser and no route checks a session. MF-43 (`/planner` that saves the user's `Selection`) and every screen with data need both. It also closes the deviation MF-20.1 left open: sign-ins and refused sign-ins are not logged yet (safety-first P7, §4).

**Result:** in the browser you sign in with an account created by MF-20.2 and see a protected route; without a session you do not get in.

## What Changes

- **`/login`**: a form with email and password. On success it starts a session (MF-20.1) and goes to the protected route; on failure it shows one message for every wrong-credentials case, so it does not reveal which emails have an account. No sign-up link, no password recovery (SEG-sistema-cerrado). It takes no redirect target from the URL (no open redirect).
- **Sign-out**: a button that revokes the session in the database (MF-20.1) and goes back to `/`.
- **Session checked on the server** for every protected route: no session, an expired one, a revoked one or a forged cookie all redirect to `/login` before any data is read (safety-first §2.2, P5).
- **`/planner` as the protected route**, with a placeholder body that MF-43 replaces. It is the first screen of producto.md §4 that needs a session.
- **`/` shows the sign-in form** for now (decided by the author, 2026-10-04): without a session, the same form as `/login`, with no catalogue data; with one, it goes to `/planner`. The placeholder "Hello world!" goes away. The informative home and the dashboard come later (see Deviations).
- **Sign-in log**: a successful sign-in, a refused one and a sign-out each write one structured line with the user id when there is one, never the email or the password (safety-first §4).
- **The web reaches the authentication through server actions only** (design D1, decided by the author on 2026-10-04): no library endpoint is mounted, so `/api/auth/*` does not exist and the closed sign-up cannot even be reached. This changes MF-21 (see Deviations).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `authentication`: its purpose already names the login page and the protected routes as MF-20.3. New requirements for signing in from the browser, signing out, protecting routes, what `/` shows, and logging sign-ins. The existing requirements (closed sign-up, session lifetime, cookie) do not change.

## Impact

- **Code:** `src/app/login/` (page and server action), `src/app/planner/page.tsx`, `src/app/page.tsx`; `src/features/auth/` (login form and sign-out button, Scope Rule); `src/composition/web-container.ts` (new, the first web composition root, ADR-001 §5); a port and use cases for the session in `src/application/` (design D2); an adapter in `src/infrastructure/auth/` and one in `src/infrastructure/logging/`. No `src/app/api/auth/` route (D1).
- **UI:** text in Spanish and plain Tailwind; the author's design system is integrated in MF-47 (new roadmap item, added by this change).
- **Dependencies:** none new. `better-auth` 1.7.6 ships its Next.js integration (`better-auth/next-js`).
- **CI:** the end-to-end test "no session" runs in CI and blocks the merge (safety-first §3). The build and `pnpm start` need `BETTER_AUTH_SECRET` and a database URL in the CI job; a throwaway secret is generated in the workflow, no real one. The end-to-end sign-in needs a database and runs locally until MF-44.
- **Config:** `BETTER_AUTH_URL` for the web (MF-20.1 D4). No new secret.

### Data touched

The session cookie and the session rows of MF-20.1, the email and password typed in the form (never stored or logged by this change), and the user id in the log. No nutritionist data: `/planner` shows a placeholder, no menus.

### Possible abuses and OWASP 2025 (SEG-owasp, `context/OWASP-Top10.md`)

| Category | Abuse | Control |
|---|---|---|
| A01 Broken access control | Reaching `/planner` without a session, with a forged cookie or with a revoked one; trusting a check made in the client | The server checks the session in the page before rendering anything; tests for no cookie, a forged cookie and a signed-out cookie. The check is not in a layout (Next.js guide: layouts do not re-run on navigation). |
| A01 Broken access control | Open redirect: `/login?next=https://evil.example` | The login takes no target from the request; it always goes to `/planner`. A test sends such a parameter. |
| A07 Authentication failures | Account enumeration through the form message | One message for unknown email and wrong password (the library answers the same, MF-20.1); a test compares both pages. |
| A07 Authentication failures | Brute force on the form | Out of scope: MF-21, with its own counter of failed sign-ins (D1). |
| A05 Injection / A06 Insecure design | Hostile values in the form (`' OR 1=1; --`, emoji, 10 000 characters, null byte), or the server action called directly with a crafted body | The server action validates the shape and length on the server before calling the library; a test sends such values to the action, not through the form. |
| A01 / CSRF | A third-party page posts to the sign-in or sign-out | Server actions check the `Origin` header in Next.js. `SameSite=Lax` cookie (library default). |
| A06 Insecure design | The library's endpoints (`update-user`, `change-password`, `list-sessions`…) reachable from outside | None is mounted (D1); a test checks that `/api/auth/*` answers 404. |
| A09 Logging and alerting | Sign-ins that nobody can see | One structured line per sign-in, refused sign-in and sign-out, with user id and time, no email or password. Alerting on spikes is MF-32 (Sentry). |
| A02 Security misconfiguration | A real secret in CI; the web building the open-sign-up setup | CI generates a throwaway secret. `web-container.ts` cannot import `create-account` (ESLint rule from MF-20.1, now exercised by a real file). |

### Decisions it relies on

SEG-auth, SEG-sistema-cerrado, SEG-roles, SEG-rate-limit, UI-home-sin-login, ARQ-hexagonal, OPS-calidad, OPS-ci-cd; ADR-001 §2, §3 and §5.

### Deviations and consequences

- **SEG-rate-limit says the login limit is "the rate limit of Better Auth".** Checked in `better-auth` 1.7.6 (`dist/api/index.mjs`): the rate limiter and the origin check run only in the library's HTTP router, not in its server calls (`auth.api.*`). With D1 (b), decided by the author, the library limit never runs, so MF-21 limits sign-in with its own counter (the `RateLimiter` port SEG-rate-limit already plans for the LLM cap), about 0.5 h more. SEG-rate-limit in `context/decisiones.md` §1.8 and the MF-21 entry in `context/roadmap.md` are updated in the closing task.
- **UI-home-sin-login says `/` without a session is an informative home with access to the login, and with one the dashboard.** For now `/` shows the sign-in form and sends a signed-in user to `/planner` (decided by the author, 2026-10-04); `/login` stays as its own route. What it keeps: no catalogue data without a session, no sign-up, state decided on the server. UI-home-sin-login in `context/decisiones.md` §1.3 is updated in the closing task to say the informative home and the dashboard are deferred.
- **SEG-auth and the archived requirement "Session lifetime and revocation" describe a sliding 7-day window.** It still holds on the server (the library renews the row), but in the web the cookie is only renewed inside a server action, so a session ends 7 days after sign-in (design, first risk). Accepted by the author on 2026-10-04 (option A); SEG-auth says so in the closing task.
- **Closes the MF-20.1 deviation on safety-first §4 (login logged).** Logging goes to the server output (`stdout`); sending it to Sentry is MF-32.
- **Integration tests skipped in CI until MF-44**, as in MF-20.1 and MF-20.2. The "no session" end-to-end test does not need a database, so it runs in CI from this change.
- **MF-20 is not ✅ after this change:** MF-44 must run the integration tests in CI first (roadmap).
