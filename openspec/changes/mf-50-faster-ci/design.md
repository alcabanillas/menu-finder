## Context

See proposal.md - Why. Current state that shapes the approach:

- `src/infrastructure/postgres/test-database.ts`: `createMigratedTestDatabase(url)` creates a `test_<seconds>_<12 hex>` schema, applies every migration with `PostgresMigrationRunner` and returns `{ pool, schema, drop }`. The pool's `search_path` is `<schema>,public`. The record of applied migrations, `schema_migration`, lives in the same schema as the tables.
- The migrations create eleven tables: `menu`, `meal`, `recipe`, `menu_dish`, `recipe_ingredient`, `recipe_embedding` (001), `user`, `session`, `account`, `verification` (002) and `shopping_item` (004).
- Three tests break their schema on purpose to check how the repositories report a database error: `postgres-menu-repository.test.ts` renames a column of `menu_dish` and drops `menu_dish`, and `postgres-recipe-repository.test.ts` drops `recipe_ingredient`.
- `.github/workflows/ci.yml` has one job, `ci`, with `contents: read`. Since MF-49, `pnpm test:e2e` builds the app itself and its Playwright global setup migrates the `ci` branch; it needs `BETTER_AUTH_SECRET` and `DATABASE_URL_TEST` in the environment.

## Goals / Non-Goals

**Goals:**
- Fewer round trips to Neon per run, with the same tests and the same assertions.
- The end-to-end tests no longer wait for the Vitest step.

**Non-Goals:**
- Moving the Neon project to another region: `production` serves Vercel from Europe.
- Transactions rolled back after each test: the repositories open their own transactions on the pool, so a test-level transaction would need every adapter to accept a client.
- Caching the Playwright browsers or the Next.js build between runs.
- Changing the four auth test files: they already create their database once per file.

## Decisions

### D1. Per file: `beforeAll` creates, `beforeEach` empties and seeds, `afterAll` drops

Five files in `src/infrastructure/postgres/` create a migrated database in a `beforeEach` today: `postgres-dish-text-search.test.ts`, `postgres-menu-repository.test.ts`, `postgres-recipe-repository.test.ts`, `postgres-recipe-embedding-repository.test.ts` and `postgres-shopping-list-repository.test.ts`. In them, `createMigratedTestDatabase` moves to `beforeAll` and `db.drop()` to `afterAll`. `beforeEach` empties the database (`db.truncate()`, D2) and then writes the same seed data as today, so each test still starts from the state it starts from now. The repository objects (`search`, `store`, …) are built once, in `beforeAll`, over the shared pool.

The three tests that break their schema (Context) get a database of their own inside the test: `createMigratedTestDatabase` at its start and `drop` in a `finally`. They cannot run on the shared database, because the tests after them would find a table missing. *Alternative:* keep `beforeEach` for those files. Rejected: `postgres-menu-repository.test.ts` has nine tests and only two break the schema.

### D2. `TestDatabase.truncate()` empties its own schema in one statement

`createTestDatabase` adds `truncate` to the object it returns. It lists the tables of its schema from `pg_tables` (`schemaname = <its schema>`), leaves out `schema_migration`, and runs one `TRUNCATE <t1>, <t2>, … RESTART IDENTITY CASCADE` over the schema-qualified names. One round trip to list and one to empty, against four migrations and a schema drop today.

`RESTART IDENTITY` resets any sequence of those tables, so a table with an identity column, if a migration ever adds one, starts as in a fresh schema. `CASCADE` covers the foreign keys between the tables. The names come from the catalogue of a schema whose name the code generated, never from input; each is quoted as an identifier.

*Alternative:* a fixed list of tables in the test helper. Rejected: the next migration would have to update it, and a forgotten table would leak data between tests silently.

### D3. Two parallel CI jobs: `checks` and `e2e`

`.github/workflows/ci.yml` splits `ci` into `checks` (install, lint, typecheck, `pnpm test:coverage`) and `e2e` (install, the authentication and database variables step, `playwright install --with-deps chromium`, `pnpm test:e2e`). Neither has `needs`, so they run at the same time and the run lasts as long as the slower one. Each repeats checkout, pnpm and Node setup and `pnpm install --frozen-lockfile` (about 15 s, cached by `setup-node`). Both keep `permissions: contents: read` at the workflow level and the same `concurrency` group.

Both jobs use the `ci` Neon branch at once: Vitest in its own `test_…` schemas, and the end-to-end run in `public`. They do not share tables. The stale-schema cleanup only drops schemas older than one hour (MF-49 design D5), so it never drops one the other job is using.

*Alternative:* a third job for lint and typecheck. Rejected: they take 15 s together, less than the setup a new job repeats.

*Alternative:* an aggregate job named `ci` with `needs: [checks, e2e]`, so the required check keeps its name. Rejected by the author on 2026-10-06: a job whose dependency fails is skipped, and GitHub counts a skipped required check as passed, so it would need `if: always()` and a check of each result; changing the required checks by hand once is simpler.

The ruleset of `main` requires a status check named after the job, `ci`: the author updates it to `checks` and `e2e` before merging (Migration Plan).

## Risks / Trade-offs

- [A test depends on data another test of the same file wrote] → It would fail after D2, since every test now starts from emptied tables plus the seed. Today each test already starts from a fresh database, so no test can depend on another; the full suite runs before archiving.
- [A future test breaks the schema on the shared database] → The tests after it fail with a missing table, in the same file and in the same run, so it is found at once. A comment over the per-file `beforeAll` says that a test that alters the schema needs its own database.
- [The "other schemas untouched" test needs rows in `public`] → It counts the rows of `public.schema_migration` before and after, which exists on the `test` and `ci` branches because the end-to-end global setup migrates `public` (MF-49). It writes nothing to `public`. For the other schema it uses a second test database of its own.
- [Two jobs use more runner minutes] → About 15 s of repeated setup per run; public repository, no cost.

## Migration Plan

1. The PR's own CI already runs with two jobs, which publishes the `checks` and `e2e` checks.
2. Manual, by the author, before merging: the ruleset of `main` requires the `ci` check, which this change stops producing, so the PR would wait for it forever. Replace `ci` with `checks` and `e2e` in the ruleset (Settings → Rules), choosing them from the list once the first run has published them. Keep `scan-pr / osv-scan`.
3. Rollback: revert the commit, and put `ci` back in the ruleset.
