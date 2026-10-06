## 1. Emptying a test database (spec: Integration tests that share a database start from empty tables)

- [x] 1.1 RED: in `src/infrastructure/postgres/test-database.test.ts`, tests for `truncate()` on a migrated test database (design D2): after writing rows to `menu` and `shopping_item` and emptying, every table of the schema except `schema_migration` has no rows and `schema_migration` keeps the same rows it had before (scenario "Tables emptied"); after emptying, a row can be written to `menu` again (scenario "Usable again after emptying"); a second test database with rows in `menu` keeps them, and the row count of `public.schema_migration` is the same before and after (scenario "Other schemas untouched"). Run them and see them fail
- [x] 1.2 GREEN: `truncate` in `createTestDatabase`, listing the schema's tables from `pg_tables` and emptying them with one `TRUNCATE … RESTART IDENTITY CASCADE` (design D2); the 1.1 tests pass

## 2. One database per integration test file (design D1)

- [x] 2.1 `postgres-dish-text-search.test.ts`: `beforeAll` creates the database and the search, `beforeEach` empties and seeds, `afterAll` drops; its 12 tests pass against the `test` branch
- [x] 2.2 `postgres-recipe-embedding-repository.test.ts` and `postgres-shopping-list-repository.test.ts`, the same way; their tests pass
- [x] 2.3 `postgres-menu-repository.test.ts` and `postgres-recipe-repository.test.ts`, the same way, except the three tests that drop or rename a table: each creates its own migrated database and drops it in a `finally`. A comment over the shared `beforeAll` says that a test that alters the schema needs its own database. Their tests pass
- [x] 2.4 `pnpm test:run` with `DATABASE_URL_TEST`: every test passes, none skipped, and afterwards the `test` branch has no `test_…` schemas

## 3. Two CI jobs (design D3)

- [x] 3.1 Split `.github/workflows/ci.yml` into `checks` (install, lint, typecheck, `pnpm test:coverage`) and `e2e` (install, the authentication and database variables step, `playwright install`, `pnpm test:e2e`), with no `needs` between them; keep the workflow-level `permissions` and `concurrency`
- [ ] 3.2 On the PR, both jobs pass, they run at the same time, and the e2e log shows the sign-in tests running, not skipped. Record the run's total time and the `pnpm test:coverage` step time and check the **Result** of proposal.md (less than 290 s and less than 187 s)

## 4. Verification and cleanup

- [x] 4.1 `pnpm lint` and `pnpm typecheck` clean
- [ ] 4.2 Manual, by the author, before merging: in the ruleset of `main` (Settings → Rules) replace the required check `ci` with `checks` and `e2e`, once the first run of the PR has published them; keep `scan-pr / osv-scan`
- [x] 4.3 Go through `context/safety-first.md` §4 and record the result before archiving

  Result of `context/safety-first.md` §4 (2026-10-06): the change touches test tooling and the CI workflow, no product code, so the endpoint, session, response, LLM and logging items do not apply. Applicable items, all yes: no secret in the diff (the workflow only reads `secrets.DATABASE_URL_TEST`, as before; `permissions: contents: read` kept); no new dependency; the one new query takes table names from `pg_tables` for the schema the code generated, quoted with `pg.escapeIdentifier`, and the schema name never comes from input; the "Other schemas untouched" test is the negative scenario for the destructive operation. No deviation from a MUST rule.
