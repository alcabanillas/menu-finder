Every test task comes before its implementation task and is run and seen failing first (PROC-tdd). Integration tests need `DATABASE_URL_TEST` (the Neon `test` branch) and are skipped in CI until MF-44.

## 1. Checks before code

- [x] 1.1 Development database: `.env.local` points `DATABASE_URL` at `production`, which has no authentication tables until MF-46. Create the Neon branch `mf-20-3-login` from `production`, point `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` of the worktree's `.env.local` at it, add `BETTER_AUTH_URL=http://localhost:3000`, apply `002-auth-schema.sql` with `pnpm ingest migrate`, and create an account with `pnpm ingest account`. Verify that `user`, `session`, `account` and `verification` exist on the branch and not on `production`, and that `pnpm dev` starts. Delete the branch after the archive
- [x] 1.2 Timebox 20 minutes: on the branch of 1.1, sign in through `auth.api.signInEmail` with the `nextCookies` plugin inside a server action, move the session's `updated_at` back more than 1 day, read the session from a Server Component and record whether the browser cookie gets a new expiry (`Set-Cookie`). Write the result under the first risk of `design.md`; if the cookie is not renewed, stop and take the options to the author before 4.x

## 2. Application: ports and use cases (D2, D3, D4)

- [x] 2.1 Write `src/application/ports/session-manager.ts` (`SessionManager`, `Credentials`, `SignedInUser`, `SignInError`) and `src/application/ports/audit-log.ts` (`AuditLog`, `AuditEvent`); verify `pnpm typecheck` passes
- [x] 2.2 Tests for `signIn` with fakes of both ports: correct credentials return the user and log `sign-in` with the id; wrong credentials return `wrong-credentials` and log `sign-in-refused`/`wrong-credentials`; empty email or password return `email-required`/`password-required` without calling the port; email over 254, password over 128, null byte, missing field or non-text field return `wrong-credentials`, log `invalid-input` and never call the port; the email reaches the port NFC-normalised and trimmed; no logged event contains the email or the password. Run and see them fail
- [x] 2.3 Implement `src/application/use-cases/sign-in.ts` with a Zod schema; verify the tests of 2.2 pass
- [x] 2.4 Tests for `signOut` (logs `sign-out` with the returned id; logs nothing user-related and does not fail when there was no session) and `currentUser` (returns the port's answer). Run and see them fail
- [x] 2.5 Implement `src/application/use-cases/sign-out.ts` and `current-user.ts`; verify the tests of 2.4 pass

## 3. Infrastructure: adapters

- [x] 3.1 Test for `StdoutAuditLog`: one JSON line per event with `type`, `at` and `userId`/`reason` when present, and nothing else. Run and see it fail
- [x] 3.2 Implement `src/infrastructure/logging/stdout-audit-log.ts`; verify the test of 3.1 passes
- [x] 3.3 Integration tests for `BetterAuthSessionManager` on the migrated test schema, with `next/headers` mocked to a cookie store: a correct sign-in sets an `HttpOnly` session cookie and adds a session row; a wrong password and an unknown email both return `wrong-credentials` and add no row; `current` returns `{ userId, name }` for a valid cookie and `null` for no cookie, a modified cookie, an expired session and a signed-out one; `signOut` deletes the row and clears the cookie, and returns `userId: null` with no cookie. Run and see them fail
- [x] 3.4 Implement `src/infrastructure/auth/better-auth-session-manager.ts` and add the `nextCookies` plugin to the closed setup in `create-auth.ts` only; verify the tests of 3.3 and every existing `infrastructure/auth/` test pass

## 4. Composition and pages

- [x] 4.1 Test for `web-container.ts`: a missing `DATABASE_URL`, `BETTER_AUTH_SECRET` or `BETTER_AUTH_URL` throws at the first call naming the variable and not its value; importing it does not throw; two calls reuse the same pool. Run and see it fail
- [x] 4.2 Implement `src/composition/web-container.ts` (D5); verify the test of 4.1 passes and `account-creation-boundary.test.ts` still passes against the real file
- [x] 4.3 Component tests in `src/features/auth/` with a fake action: `LoginForm` renders email, password and submit, shows the message the action returns, and has no sign-up or recovery link; `SignOutButton` submits its action. Run and see them fail
- [x] 4.4 Implement `LoginForm` and `SignOutButton`; verify the tests of 4.3 pass
- [x] 4.5 Test that lists every `page.tsx` under `src/app/` and fails if one other than `/` and `/login` does not call `requireUser` (D6); test that `requireUser` redirects to `/login` when `currentUser` is `null`. Run and see them fail (`/planner` does not exist yet)
- [x] 4.6 Implement `src/app/_session/require-user.ts`, the sign-out action, `src/app/planner/page.tsx` (placeholder with the user's name and `SignOutButton`), `src/app/login/page.tsx` and `actions.ts` (redirect to `/planner` on success and when already signed in; no redirect target read from the request), and `src/app/page.tsx` (the same `LoginForm` and action without a session, redirect to `/planner` with one); update `page.test.tsx` for both cases. Verify the tests of 4.5 and `pnpm lint` pass

## 5. End to end

- [x] 5.1 Playwright tests that need no database, run in CI: `/planner` with no cookie and with a forged cookie redirects to `/login`; `/` without a session shows the sign-in form and no sign-up or recovery; `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/update-user` and `/api/auth/list-sessions` answer 404. Replace `e2e/home.spec.ts`. Run and see them fail before 4.6, pass after
- [x] 5.2 Playwright tests that need the database of the app (`DATABASE_URL`, the development branch), skipped in CI until MF-44, each run creating its own account with `pnpm ingest account`: sign in with an account created by `pnpm ingest account`, from `/login` and from `/`, and land on `/planner`; `/` with a session goes to `/planner`; wrong password and unknown email show the same message; `/login?next=https://evil.example` ends on `/planner`; hostile values give the wrong-credentials message; sign out ends on `/` and the old cookie is sent to `/login`; `/login` with a session goes to `/planner`. Run locally and see them pass
- [x] 5.3 In `.github/workflows/ci.yml`, give the build and e2e steps a random `BETTER_AUTH_SECRET` per run, `BETTER_AUTH_URL=http://localhost:3000` and a dummy `DATABASE_URL`; verify on the PR that the tests of 5.1 run and pass in CI
- [x] 5.4 By hand in the browser: sign in with an account of MF-20.2, see `/planner`, sign out, check that `/planner` sends you to `/login`, and check the three log lines in the `pnpm dev` output (no email, no password)

## 6. Closing

- [x] 6.1 Update `context/decisiones.md` §1.8: SEG-auth (the web uses server actions with `nextCookies`, no auth endpoint mounted; sign-ins logged with user id; in the web a session lasts 7 days from sign-in, because the cookie is only renewed in a server action, design risk 1, option A) and SEG-rate-limit (the login limit is our own counter behind `RateLimiter`, because the library limiter only runs in its HTTP handler), with the D1 reason; and §1.3 UI-home-sin-login (for now `/` shows the sign-in form and sends a signed-in user to `/planner`; the informative home and the dashboard are deferred)
- [x] 6.2 Update `context/roadmap.md`: mark MF-20.3 done with the link to the archived change, and update MF-21 (own counter of failed sign-ins per IP behind `RateLimiter`, estimate +0.5 h)
- [x] 6.3 Update the Purpose of `openspec/specs/authentication/spec.md` at archive: it covers the login page and protected routes now
- [x] 6.4 Go through `context/safety-first.md` §4 and record each answer here; `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` pass

  Checklist of `context/safety-first.md` §4 (2026-10-04):

  - **Critical decisions in the backend:** yes. The session is checked in each page on the server (`requireUser`); the form only renders, and its `required` attributes are UX, repeated by the Zod schema of `signIn`.
  - **Every new entry point validates auth, permissions and input shape:** yes. The two server actions take unknown values and `signIn` validates type, length and null bytes before the library; `/planner` checks the session first. No HTTP endpoint of the library exists (`/api/auth/*` answers 404, tested).
  - **User from the session, not from the request:** yes. Nothing reads a user id from the request; `SignedInUser` comes from the session.
  - **Negative authorization tests in CI:** yes. No cookie, a forged cookie and the 307 without the page body run in CI (`e2e/access.spec.ts`, simulated locally with `CI=1`). The signed-out-cookie case needs the database and runs locally until MF-44. Task 5.3 confirms it on the PR.
  - **Minimum data returned:** yes. Pages get `{ userId, name }` only.
  - **No secret in the diff:** yes. `.env.local` is ignored; CI generates a throwaway secret per run and masks it.
  - **New dependencies:** none. `nextCookies` is part of `better-auth` 1.7.6.
  - **Parameterised queries:** yes. No SQL in the new production code; the library queries through its adapter.
  - **Unexpected values tested:** yes. Empty, missing, non-text, 10 000 characters, null byte, SQL metacharacters and emoji in `sign-in.test.ts`, in the adapter tests and through the browser with validation off (`e2e/sign-in.spec.ts`). No LLM input in this change.
  - **Sensitive actions logged with who, what and when:** yes. `auth.sign-in`, `auth.sign-in-refused` and `auth.sign-out` with user id and time, never email or password; checked by hand in the `pnpm dev` output. The library also logs `WARN [Better Auth]: User not found` for an unknown email: no email in it, but the server log tells an unknown email from a wrong password. Accepted: it never reaches the user.
  - **Deviations documented:** yes, in `proposal.md` (SEG-rate-limit, UI-home-sin-login, the 7-day cookie). Found by hand: the `DATABASE_URL` values use `sslmode=require`; safety-first §2.3 asks for `sslmode=verify-full`. Configuration, not code: to fix in `.env.local` and in Vercel (MF-46).
