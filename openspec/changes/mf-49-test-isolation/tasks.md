## 1. Integration test schemas (spec: Integration test schemas do not outlive their run)

- [x] 1.1 RED: in `src/infrastructure/postgres/test-database.test.ts`, write the tests for `dropStaleTestSchemas(url, now)`: a test schema created more than one hour before `now` is dropped; one created less than one hour before is kept; `public` and `test_notes` are kept whatever `now` is. Run them and see them fail
- [x] 1.2 GREEN: schema names become `test_<unix seconds>_<12 hex>` and `dropStaleTestSchemas` drops only names matching `^test_[0-9]{10}_[0-9a-f]{12}$` older than one hour (design D5); the 1.1 tests pass
- [x] 1.3 RED: test that `createMigratedTestDatabase` with a migrations directory holding an invalid SQL file rejects and its schema no longer exists. See it fail
- [x] 1.4 GREEN: optional migrations directory parameter and `drop` before rethrowing (design D6); the 1.3 test passes
- [x] 1.5 Vitest `globalSetup` that calls `dropStaleTestSchemas` when `DATABASE_URL_TEST` is set, wired in `vitest.config.mts`; verify `pnpm test:run` passes and, after it, the `test` branch has no `test_…` schemas

## 2. End-to-end environment (spec: The end-to-end run uses only the test database)

- [x] 2.1 RED: in `e2e/support/e2e-environment.test.ts`, tests for the server environment function (design D1): with `DATABASE_URL_TEST`, both database variables equal it; with a different app `DATABASE_URL` in the env file, that URL appears nowhere in the result; without `DATABASE_URL_TEST`, both point to `unreachable.invalid`; `DATABASE_URL_TEST` from `process.env` wins over the env file; `BETTER_AUTH_URL` uses port 3100. Add `e2e/**/*.test.ts` to the Vitest `unit` project and see them fail
- [x] 2.2 GREEN: implement `e2e/support/e2e-environment.ts`; the 2.1 tests pass
- [x] 2.3 `playwright.config.ts`: port 3100, `reuseExistingServer: false`, command `pnpm build && pnpm start -p 3100`, `webServer.env` from 2.2, `testMatch: '**/*.spec.ts'` (design D2). Verify with a `pnpm dev` left open on port 3000 that `pnpm test:e2e` starts its own server on 3100

## 3. Migration before the run (spec: The test database is migrated before the end-to-end run)

- [x] 3.1 RED: unit test for the global setup's decision: with `DATABASE_URL_TEST` it runs `pnpm ingest migrate` with the 2.2 environment; without it, it runs nothing. See it fail
- [x] 3.2 GREEN: `e2e/support/global-setup.ts`, wired as Playwright `globalSetup` (design D3); the 3.1 test passes, and a local `pnpm test:e2e` leaves the `test` branch with all four migrations in `public.schema_migration`
- [ ] 3.3 Remove the "Migrate the CI database" and `pnpm build` steps from `.github/workflows/ci.yml` (the web server command builds, design D2); verify the PR's CI log shows the global setup applying or finding no pending migrations, and the sign-in tests running, not skipped

## 4. End-to-end account (spec: The end-to-end account is deleted)

- [x] 4.1 RED: in `e2e/sign-in.spec.ts`, add an `afterAll` that deletes the run's account by email on `DATABASE_URL_TEST` and expects exactly one deleted row and none left; pass the 2.2 environment to the `execSync` of `beforeAll`. Before the environment is passed, the account lands in the app database, so the delete finds zero rows: see it fail
- [x] 4.2 GREEN: with the environment passed, the account is created on the test branch and the `afterAll` passes; skip the sign-in tests whenever `DATABASE_URL_TEST` is missing, locally too (spec scenario "No test database configured")

## 5. Verification and cleanup

- [x] 5.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:run` and `pnpm test:e2e` locally; verify the **Result**: the `production` branch has no new `e2e-…` accounts and the `test` branch has no `test_…` schemas
- [x] 5.2 Manual, by the author: delete the `e2e-%@example.test` accounts already in `production`
- [x] 5.3 Go through `context/safety-first.md` §4 and record the result before archiving

## Security checklist (`context/safety-first.md` §4), 2026-10-05

- **Business and security decisions in the backend:** yes. Database isolation and cleanup live entirely in test environment configuration and runner scripts; no client logic touched.
- **New endpoints (auth, permissions, negative tests):** not applicable. No new HTTP endpoints created.
- **User from the session:** not applicable. Test harness execution and administrative CLI only.
- **Minimum data returned:** yes. Test utilities query only schema metadata and row counts for verification.
- **No secrets in the diff:** yes. Verified: database credentials and connection strings are read dynamically from environment or `.env.local`; no hardcoded passwords, tokens, or connection strings.
- **New dependencies:** none. Reused `pg`, `@playwright/test`, and `vitest`.
- **Parameterised queries:** yes. All cleanup and verification queries are parameterized (`WHERE email = $1`, `WHERE nspname ~ $1`). Schema drop uses strict regex validation (`^test_\d{10}_[0-9a-f]{12}$`) preventing any SQL injection or accidental drops of real schemas.
- **Tests with unexpected values:** yes. Tested invalid/corrupted migration SQL files, schemas with non-matching names (`test_notes`, loose hex length), and missing/empty `DATABASE_URL_TEST` falling back safely to `unreachable.invalid`.
- **Sensitive actions logged:** not applicable. Transient test cleanup.
- **Deviations from a MUST rule:** none.
