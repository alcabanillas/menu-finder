## 1. Checks before coding

- [x] 1.1 Timeboxed experiment (30 min) on the Neon branch `mf-20-1-auth-server` with `better-auth` installed: try options (a), (b) and (c) of D1 in `design.md`, one throwaway test each, and write what happened under D1; the author chooses D1 and confirms D2 to D6 (including the password limits of D6), then `design.md` and the spec are updated to match; verify: the result of each option is written in `design.md`, the choice is in the chat, and `design.md` and `specs/authentication/spec.md` say the same
- [x] 1.2 Check the dependency before keeping it: it exists on npm under the expected name, its maintenance and release date, and that the installed version is at least 7 days old (OPS-ci-cd); verify: the result is written in `design.md` D1's table or in the PR text, `pnpm install --frozen-lockfile` works, and `osv-scanner` reports no new advisory (or the author decides on each one)
- [x] 1.3 Generate `BETTER_AUTH_SECRET` (random, 32 bytes or more) and the base URL in the `.env.local` of the worktree only; verify: `git check-ignore .env.local` prints the file and `git status` shows no change

## 2. Schema (test first)

- [x] 2.1 Write the migration test: after `createMigratedTestDatabase`, the user, session, account and verification tables exist, each has row-level security enabled and no policy; verify: it fails because `002` does not exist
- [x] 2.2 Generate the SQL with the library's generator for PostgreSQL, review it by hand (the `user` table name is quoted, types and constraints are right), and save it as `postgres/migrations/002-auth-schema.sql` with RLS on every table; verify: the test of 2.1 passes, and the migration runner test still passes with two migrations

## 3. Authentication setup (tests first, each seen failing before its code)

- [x] 3.1 Write the tests of the closed sign-up: a request through the public interface is rejected with no new row, and an email that already has an account gets the same rejection; verify: they fail, because nothing is set up yet
- [x] 3.2 Write the tests of account creation with the second instance of D1 (open sign-up, `autoSignIn: false`): a valid account (one user, one credential account, stored value is not the password), a repeated email (existing account unchanged), a blank or malformed email, a password below the minimum and above the maximum; verify: they fail
- [x] 3.3 Write the tests of sign-in: correct credentials give a session row and an `HttpOnly` cookie, a wrong password and an unknown email give the same status and body and no session row; verify: they fail
- [x] 3.4 Write the tests of the session: older than 7 days is no session, used after 1 day is renewed by 7 days, used within a day is not renewed, a signed-out session has no row and its cookie stops working (state set by writing the session row, D7); verify: they fail
- [x] 3.5 Write the tests of the cookie and the secret: a modified cookie and a cookie from another secret are no session, a missing or too short secret makes the setup fail with an error that names the variable and does not contain any secret value; verify: they fail
- [x] 3.6 Write the hostile-input tests for sign-in and account creation (`' OR 1=1; --`, emoji, combining accent, 10 000 characters, null byte): no server error, no change in the tables; verify: they fail
- [x] 3.7 Implement `src/infrastructure/auth/` with the minimum code for 3.1 to 3.6: one function that builds the setup from a pool, the secret and the base URL, with the settings of D4 and D5 written out and the open instance built only by a function that the CLI composition root will call (task 3.8 closes `web-container.ts`; `app/` is already closed); verify: all the tests of section 3 pass and `pnpm lint` shows no boundary error
- [x] 3.8 Write a test that lints a snippet importing the open setup as if it were in `src/composition/web-container.ts` (must be rejected), in a route under `src/app/` (already rejected by the layer rules) and in `src/composition/cli-container.ts` (accepted), then add the rule for `web-container.ts` to `eslint.config.mjs`; verify: the web-container case fails first and all three pass after the rule

## 4. Run it for real

- [x] 4.1 Run `pnpm ingest migrate` against the development branch twice; verify: the first run applies only `002-auth-schema.sql` and the second applies nothing
- [x] 4.2 With the Neon MCP (`describe_branch`) or a read-only query on the development branch, check the four tables, their RLS flag and the absence of policies; verify: the output matches the requirement "Authentication tables are not reachable without the owner role"

## 5. Close

- [x] 5.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm knip`; verify: all pass, including `knip` for the function exported from `infrastructure/auth/` that only the tests use until MF-20.2 (if `knip` flags it, the author decides between an entry file and waiting for MF-20.2)
- [x] 5.2 Update `context/decisiones.md` (SEG-auth: remove "por verificar al empezar MF-20" and record the chosen mechanism and the password limits), `context/roadmap.md` (MF-20.1 ✅ with the archive link; MF-20 stays ⬜ until its three subtasks are archived), and `context/tareas/T0-extraccion-previa.md` (the new variables); verify: `grep` of the decision and task codes and a read of the changed lines
- [x] 5.3 Go through the checklist in `context/safety-first.md` §4 before archiving and record the answers at the end of this file, with the deviation of the sign-in log (MF-20.3) stated; verify: every item has an answer and a reason where it is "not applicable"

## Safety checklist (`context/safety-first.md` §4), answered on 2026-10-04

1. **Business and security decisions in the backend?** Yes. Who may register, the password limits, the session lifetime and the secret check are in the server setup (`infrastructure/auth/auth-options.ts`); this change has no client code.
2. **Each new endpoint validates auth, permissions and input shape?** Not applicable: no route is mounted here (MF-20.3 mounts the handler). The library's own handlers validate the body, and the tests cover a malformed email and both password limits.
3. **User and permissions from the session, not from client parameters?** Not applicable (no endpoint). The session is only read from the signed cookie; tests cover a modified cookie, a cookie signed with another secret, an expired and a signed-out session.
4. **Negative authorization tests for each new endpoint, running in CI?** No endpoint yet, but the negative scenarios exist (sign-up closed, wrong password, unknown email, forged cookie). **They do not run in CI today:** `.github/workflows/ci.yml` has no `DATABASE_URL_TEST`, so these Postgres integration tests are skipped there, as the MF-41 adapter tests are. This breaks `context/safety-first.md` §3 ("authorization tests MUST run in CI and block the merge"). **Deviation, for the author to decide** (a Neon branch for CI and a GitHub secret); it must be settled before MF-20 is archived as a whole.
5. **Minimum data returned?** Not applicable: no endpoint. MF-20.3 reviews what the web returns.
6. **No secret hardcoded or in the diff?** Yes. `BETTER_AUTH_SECRET` is only in the git-ignored `.env.local`; the diff was searched for connection strings and secrets (none). The secret and password of the tests are test values, marked as such.
7. **Each new dependency exists, is the intended one, is maintained and is justified (§2.5)?** Yes: `better-auth` 1.7.6, pinned, checked on npm and justified in `design.md` (task 1.2). `pnpm audit --prod` shows only the four Genkit advisories already accepted in MF-41. `osv-scanner` runs in CI on the PR.
8. **Queries parameterised?** Yes. The library builds its own parameterised queries; the migration is static DDL; the only interpolated name in the tests comes from a closed union of table names.
9. **Tests with unexpected values?** Yes: SQL metacharacters, emoji, combining accent, null byte and 10 000 characters, for sign-in and for account creation. No prompt-injection case: nothing here reaches an LLM.
10. **Sensitive actions (login, denied access) logged with who, what and when?** **Not yet.** There is no entry point to log from; stated as a deviation in `proposal.md`. MF-20.3 owns it.
11. **Deviations from a MUST rule justified and documented?** Yes: items 4 and 10 above.
