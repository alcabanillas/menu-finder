## Why

Roadmap item **MF-49**. The tests leave garbage behind, and the local end-to-end run writes to the database the app uses.

- **End-to-end, locally.** `playwright.config.ts` starts `pnpm dev` (or reuses one already open on port 3000), and `e2e/sign-in.spec.ts` creates its account with `pnpm ingest account`. Both read `DATABASE_URL` and `DATABASE_URL_UNPOOLED` from `.env.local`, which today point to the Neon branch `production` (checked on 2026-10-05: endpoint `ep-restless-surf-b1b7kdp3` belongs to branch `production`). Every run leaves an account `e2e-<timestamp>@example.test` there and nothing deletes it. CI does not have this problem: it already points both variables to `DATABASE_URL_TEST` (`.github/workflows/ci.yml`).
- **Integration tests.** Each test file creates a `test_<hex>` schema on the test branch and drops it at the end (`src/infrastructure/postgres/test-database.ts`). A run cut short (Ctrl+C, a dead worker) leaves its schemas behind, and so does `createMigratedTestDatabase` when a migration fails, because it throws before returning the `drop`.
- **The `test` branch is behind.** Its `public` schema only has migration `001-search-schema.sql` (checked on 2026-10-05), so the local end-to-end run cannot simply point to it.

The goal is that the author never has to think about which branch a test touches: tests use the test branch, always, and leave it as they found it.

**Result:** after `pnpm test:run` and `pnpm test:e2e` locally, the app branch has no new accounts and the test branch has no `test_…` schemas.

## What Changes

- **End-to-end against the test branch.** Playwright starts its own server on its own port (never reusing a `pnpm dev` that may point elsewhere) with `DATABASE_URL` and `DATABASE_URL_UNPOOLED` set to `DATABASE_URL_TEST`, read from the environment or from `.env.local` as Vitest already does. The account the sign-in tests create goes to the same branch. Without `DATABASE_URL_TEST`, the database variables point to an unreachable host and the sign-in tests are skipped, locally as in CI: the app database is never the fallback.
- **The test branch is migrated before the end-to-end run.** A Playwright global setup runs `pnpm ingest migrate` against the test branch, so the CI step that does the same goes away.
- **The end-to-end account is deleted** when the sign-in tests finish.
- **Integration schemas never outlive their run.** Each schema name carries its creation time; before every Vitest run, a global setup drops the test schemas older than one hour, left by runs that were cut short. `createMigratedTestDatabase` drops its schema when a migration fails. `public` and any schema not named like a test schema are never dropped (the `vector` and `unaccent` extensions live in `public`).
- **Manual, by the author:** delete the `e2e-…@example.test` accounts already in `production`.

## Capabilities

### New Capabilities
- `test-isolation`: where the automated tests may write, and what they must leave behind: the end-to-end run uses only the test database, deletes its account, and integration test schemas do not outlive their run.

### Modified Capabilities
- None. The `authentication` spec does not change: the end-to-end tests still check the same requirements, only against another database.

## Impact

- **Code:** `playwright.config.ts`; `e2e/sign-in.spec.ts`; new `e2e/support/` (server environment and global setup, with unit tests run by Vitest); `src/infrastructure/postgres/test-database.ts` and a Vitest global setup next to it; `vitest.config.mts`; `.github/workflows/ci.yml` (the migrate step goes into the Playwright global setup). No change in `src/domain`, `src/application`, `src/app` or `src/cli`; no port (test tooling, not a runtime boundary, ADR-001).
- **Verified behaviour this relies on (2026-10-05):** a variable already in `process.env` wins over `.env.local`, both in the CLI (`process.loadEnvFile`, tried with Node 24.15) and in Next.js (`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`, "Environment Variable Load Order"). So passing the test URLs in the environment is enough; `.env.local` is not touched.
- **Systems:** Neon branch `test` (local tests) and `ci` (CI). `production` only loses the leftover `e2e-…` accounts, by hand (done on 2026-10-05). Since OPS-ramas-bd (2026-10-05), the app branch in `.env.local` is `dev`, a copy of `production`; this change still keeps the end-to-end run off it.
- **Decisions relied on:** OPS-calidad, OPS-ci-cd, MF-41 design D8 (integration tests run against a branch kept for tests, never `production`), SEG-sistema-cerrado (accounts only from the CLI; the end-to-end account still is). Contradicts none.
- **Data:** only synthetic test accounts (`e2e-<timestamp>@example.test`, random password) and test schemas. No nutritionist data, no real user data.
- **Abuses and OWASP:** the cleanup runs `DROP SCHEMA … CASCADE`. If its pattern were loose, or `DATABASE_URL_TEST` pointed to `production` by mistake, it could drop real data: A05 Security Misconfiguration, A04 Insecure Design. Mitigation: it only drops schemas whose name matches the exact test pattern (`test_<seconds>_<12 hex>`) and are older than one hour, so even on the wrong branch it touches nothing that is not a test schema; `public` can never match. Connection URLs never reach the test output (the existing `redactSecrets` applies to the CLI output). The end-to-end account deletion is by exact email, the one the run created.
