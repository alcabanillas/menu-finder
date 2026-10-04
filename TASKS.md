# MF-20.2 — state (2026-10-04)

Branch `feature/mf-20-2-cli-create-account`, worktree `C:\Projects\master-desarrollo-ia\menu-finder-worktrees\mf-20-2-cli-create-account`. **Archived**: `openspec/changes/archive/2026-10-04-mf-20-2-cli-create-account/` (17 of 17 tasks). Main spec `openspec/specs/authentication/spec.md` synced (9 requirements). MF-20.2 is ✅ in `context/roadmap.md`.

## Blocked on me

- Open the PR for `feature/mf-20-2-cli-create-account` (the `gh` CLI is not installed here: use the web URL), and merge it.
- Confirm that the `neondb_owner` password of every Neon branch was rotated after a connection string was shown in the chat (the checklist in the archived `tasks.md` says it was; not verified).
- The Neon branch `mf-20-2-cli-create-account` holds two test accounts (`prueba1@example.test`, `prueba2@example.test`); it expires on 2026-10-05.

## Changed

- New: `src/application/ports/account-creator.ts`, `src/application/use-cases/create-account.ts`, `src/cli/commands/create-account.ts`, `src/cli/read-password.ts` and their tests, `src/composition/cli-container-account.test.ts`.
- Edited: `src/infrastructure/auth/create-account.ts` (implements the port, validates the name), `src/composition/cli-container.ts`, `src/cli/run-cli.ts`, `src/cli/index.ts`.
- Docs: `context/tareas/T0-extraccion-previa.md` (account command and the method to resolve database URLs), `context/decisiones.md` (SEG-sistema-cerrado, SEG-auth limits), `context/roadmap.md` (MF-20.2 ✅; new MF-45 change a password, MF-46 authentication in production).
- Decided by the author: password from a no-echo prompt or stdin; optional name; fixed base URL with a comment; an existing email is an error; name of 30 characters at most.

## Next

- MF-20.3 (`/login`, logout, protected routes), MF-44 (integration tests in CI), then MF-46 (production). Production has no auth tables yet and must not get migration 002 before MF-20 is archived whole.

## Found

- `DATABASE_URL_UNPOOLED` in `.env.local` points to `production`; the worktree's `.env.local` points to the Neon branch `mf-20-2-cli-create-account` and has its own `BETTER_AUTH_SECRET`. Do not copy the `.env.local` of `main` over it.
- `NEON_BRANCH` in `.env.local` is read by nothing in the repo.
- Neon roles and passwords are per branch.
- The integration test of task 4.3 passed at the first run, so its red phase was not seen.
