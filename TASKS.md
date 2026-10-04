# MF-20.2 — state (2026-10-04)

Branch `feature/mf-20-2-cli-create-account`, worktree `C:\Projects\master-desarrollo-ia\menu-finder-worktrees\mf-20-2-cli-create-account`. Change: `openspec/changes/mf-20-2-cli-create-account/` (13 of 15 tasks done; 5.1 stays open until the archive link exists).

## Checklist (mirrors `tasks.md`)

- [x] 1 Checks, 2 port and use case, 3 command, 4 wiring and integration test
- [ ] 5.1 T0 runbook and MF-45 are done; the roadmap line "MF-20.2 ✅ with the archive link" waits for the archive
- [x] 5.2 Manual run on the Neon branch `mf-20-2-cli-create-account`: prompt, stdin, repeated email, missing secret; password not echoed (confirmed by the author). The accounts `prueba1@example.test` and `prueba2@example.test` are still in that branch
- [x] 5.3 `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage`, `pnpm knip`
- [x] 5.4 `context/decisiones.md` (SEG-auth / SEG-sistema-cerrado), after the author confirms the wording
- [x] 5.5 Safety checklist `context/safety-first.md` §4 at the end of `tasks.md`
- [ ] Then: `/opsx:verify`, `/opsx:archive`, roadmap MF-20.2 ✅ with archive link, PR

## Blocked on me

- Next step: `/opsx:verify`, then `/opsx:archive`, which also sets MF-20.2 ✅ in `context/roadmap.md`. Nothing needs the author before that.
- Confirm that the `neondb_owner` password of every Neon branch was rotated after a connection string was shown in the chat (the checklist in `tasks.md` says it was; not verified).
- The two test accounts in the Neon branch `mf-20-2-cli-create-account` can stay; that branch expires on 2026-10-05.
## Changed

- New: `src/application/ports/account-creator.ts`, `src/application/use-cases/create-account.ts`, `src/cli/commands/create-account.ts`, `src/cli/read-password.ts` and their tests, `src/composition/cli-container-account.test.ts`.
- Edited: `src/infrastructure/auth/create-account.ts` (implements the port), `src/composition/cli-container.ts` (`createAccount`, fixed base URL), `src/cli/run-cli.ts` (arguments per command), `src/cli/index.ts`.
- Docs: `context/tareas/T0-extraccion-previa.md` (account command and the method to resolve database URLs), `context/roadmap.md` (MF-45: change a password).
- Decided by the author: D1 prompt without echo, stdin as fallback; optional name; fixed `http://localhost:3000` with a comment; an existing email is an error.

## Found

- `DATABASE_URL_UNPOOLED` in `.env.local` points to `production`, which has no migration 002 yet.
- `NEON_BRANCH` in `.env.local` is read by nothing in the repo.
- Neon roles and passwords are per branch (my earlier "project-level role" claim was wrong).
- The integration test of 4.3 passed at the first run, so its red phase was not seen.
- `.env.local` of this worktree is a copy of the one in `main`; copy it again after any change there.
