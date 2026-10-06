## Context

See proposal.md - Why. Current state that shapes the approach:

- `playwright.config.ts`: port 3000, `webServer` runs `pnpm dev` locally (`reuseExistingServer: true`) and `pnpm start` in CI. It passes no environment to the server, so the server reads `.env.local`.
- `e2e/sign-in.spec.ts`: `beforeAll` runs `pnpm ingest account <email> E2E` with `execSync`; the CLI (`src/cli/index.ts`) loads `.env.local` with `process.loadEnvFile`. Nothing deletes the account. The tests are skipped only in CI without `DATABASE_URL_TEST`.
- CI (`.github/workflows/ci.yml`) writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `BETTER_AUTH_URL=http://localhost:3000` to `$GITHUB_ENV`, then runs `pnpm ingest migrate` against the `ci` branch before the build.
- `vitest.config.mts` already reads only `DATABASE_URL_TEST` from `.env.local` (`testDatabaseUrl()`) and passes it to the tests; it has no global setup.
- `test-database.ts`: schema `test_<12 hex>`; `createMigratedTestDatabase` throws on a failed migration without dropping the schema.
- Both Node's `process.loadEnvFile` and Next.js keep a variable already in `process.env` over the one in `.env.local` (verified, see proposal.md - Impact).

## Goals / Non-Goals

**Goals:**
- The local and CI end-to-end runs get their database the same way, from `DATABASE_URL_TEST`.
- No manual step before running the tests locally: the test branch is migrated by the run.

**Non-Goals:**
- Changing `.env.local` or how `pnpm dev` and the CLI choose their database. The app still uses `DATABASE_URL`.
- Making the access end-to-end tests (`e2e/access.spec.ts`) use a database: they never reach it.
- Creating or resetting Neon branches from the tests.

## Decisions

### D1. The test URL reaches the server and the CLI through the environment, not through a second env file

`playwright.config.ts` builds the server environment with a pure function in `e2e/support/e2e-environment.ts`: given `DATABASE_URL_TEST` (from `process.env`, else from `.env.local`, read with `node:util` `parseEnv` as `vitest.config.mts` does), it returns `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `BETTER_AUTH_URL` for the e2e port; without it, both database variables are `postgresql://e2e:e2e@unreachable.invalid:5432/none`, the same placeholder CI uses. The config passes that object to `webServer.env` and exports it for the spec, which passes it to `execSync` for the CLI.

Because `process.env` wins over `.env.local` in both Next.js and the CLI, nothing else changes. *Alternative:* a `.env.test` file, or `NODE_ENV=test` (Next.js skips `.env.local` then). Rejected: a second file to keep in sync, and `NODE_ENV=test` changes how Next.js builds, which the end-to-end tests should not.

The function is unit-tested by Vitest (`e2e/support/*.test.ts` added to the `unit` project). Playwright's `testMatch` becomes `**/*.spec.ts`, so it does not pick those files up.

### D2. Own production server on port 3100, never reused

`webServer.reuseExistingServer: false` and port 3100. A `pnpm dev` the author leaves open on 3000 points to the app database; reusing it was how the local run reached `production`. The command is `pnpm build && pnpm start -p 3100`, locally and in CI. A second `next dev` cannot run in the same directory (Next 16: "Another next dev server is already running", verified on 2026-10-05), so the run cannot use a dev server of its own; building and starting is also what CI already tests. The build gets the same environment as the server (D1), and the CI step `pnpm build` goes away because the web server command builds. `BETTER_AUTH_URL` follows the port. *Alternative:* a separate `distDir` for an e2e dev server. Rejected: an e2e-only switch in `next.config`, and unverified that two dev servers can coexist.

### D3. Migrations in a Playwright global setup

`e2e/support/global-setup.ts` runs `pnpm ingest migrate` with the D1 environment when `DATABASE_URL_TEST` is set, and does nothing otherwise. It replaces the CI step "Migrate the CI database", so CI and local run the same thing. Migrations are recorded in `schema_migration`, so a second run applies nothing. *Alternative:* a one-off manual `pnpm ingest migrate` against the `test` branch, as the roadmap item suggested. Rejected: the next migration would leave the branch behind again, which is the problem this change removes.

### D4. Account deletion with SQL from the spec

`afterAll` in `e2e/sign-in.spec.ts` deletes the account with `DELETE FROM "user" WHERE email = $1` over a `pg` client on `DATABASE_URL_TEST`, and expects one row. `session` and `account` go with it (`ON DELETE CASCADE` in `002-auth-schema.sql`). *Alternative:* a CLI command to delete accounts. Rejected: it would be a new destructive command in production code, with its own authorization and validation scenarios, only to serve a test. MF-45 (change a password) is the place to reconsider account management commands.

### D5. Test schema names carry their creation time; stale ones are dropped by a Vitest global setup

The schema name becomes `test_<unix seconds>_<12 hex>`. A function in `test-database.ts`, `dropStaleTestSchemas(url, now)`, lists schemas matching `^test_[0-9]{10}_[0-9a-f]{12}$` and drops those older than one hour. A Vitest `globalSetup` calls it once per run when `DATABASE_URL_TEST` is set.

The age limit is what keeps two runs from deleting each other's schemas (for example `pnpm test` in watch mode and `pnpm test:run` at the same time): one hour is far above the longest integration test file. *Alternative:* drop every `test_…` schema at start, as the roadmap item says. Rejected for that reason. *Alternative:* a lock or registry table. Rejected: more moving parts for a case the age solves.

The strict pattern is the safety net against a wrong `DATABASE_URL_TEST`: `public` and any schema the app or a person created cannot match it.

### D6. `createMigratedTestDatabase` drops its schema on failure

It wraps the migration loop and calls the database's `drop` before rethrowing. To test it, the migrations directory becomes an optional parameter (default `MIGRATIONS_DIR`), so a test can pass a directory with an invalid migration.

## Risks / Trade-offs

- [The Neon branch `test` expires on 2026-10-11 (`expires_at`, seen on 2026-10-05)] → After that, `DATABASE_URL_TEST` in `.env.local` points nowhere and the local integration and sign-in tests are skipped, silently except for the stderr line. The author removes the expiry in the Neon console, or recreates the branch and updates `.env.local`. This change does not touch Neon settings.
- [Port 3100 already in use locally] → Playwright fails to start the server with a clear error; the port is a constant in the config.
- [An `afterAll` that does not run (run killed)] → One account stays on the test branch, never on the app branch. Acceptable: the test branch holds nothing real.
- [`dropStaleTestSchemas` run against the wrong branch] → It only drops test-named schemas over one hour old (D5).

## Migration Plan

1. Merge; CI runs the end-to-end tests against the `ci` branch with the new global setup.
2. Manual, by the author: delete the `e2e-%@example.test` accounts in `production` (their sessions go by cascade).
3. Rollback: revert the commit. Nothing in any database depends on this change.
