## Why

Roadmap item **MF-50**. The CI run of PR #25 (run 37437262895, 2026-10-06) took 290 s, and 187 s of them were `pnpm test:coverage`. The same command takes 37 s locally. Across the last twelve successful runs, that step took between 103 s and 187 s. The tests are not slow: they are network-bound against Neon (`eu-central-1`), and they make far more round trips than they need.

- **Five integration test files rebuild their database for every test.** `postgres-dish-text-search`, `postgres-menu-repository`, `postgres-recipe-repository`, `postgres-recipe-embedding-repository` and `postgres-shopping-list-repository` call `createMigratedTestDatabase` in a `beforeEach`: every test creates a schema, applies the four migrations and drops the schema. `postgres-dish-text-search.test.ts` alone does it twelve times. Four auth test files already do it once per file (`beforeAll`).
- **The end-to-end tests wait for Vitest.** In one job, `playwright install` (23 s) and `pnpm test:e2e` (43 s, build included) only start when `pnpm test:coverage` ends, though they do not depend on it.

**Result:** the PR's CI run takes less than 290 s and its `pnpm test:coverage` step less than 187 s, with the same tests green.

## What Changes

- **One migrated database per integration test file.** The five files above create it once (`beforeAll`), empty its tables before each test, and drop it at the end (`afterAll`). The test database gets a way to empty its own tables in one statement.
- **Tests that break the schema keep a database of their own.** Three tests drop or rename a table on purpose to provoke a database error (`postgres-menu-repository.test.ts`, `postgres-recipe-repository.test.ts`). They keep creating and dropping their own database, so they cannot break the shared one.
- **End-to-end in its own CI job.** `.github/workflows/ci.yml` gets two jobs that run in parallel: lint, typecheck and `pnpm test:coverage` in one; `playwright install` and `pnpm test:e2e` in the other.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `test-isolation`: a new requirement, so the integration tests of one file never see each other's data now that they share a database.

## Impact

- **Code:** `src/infrastructure/postgres/test-database.ts` and its test; the five integration test files above; `.github/workflows/ci.yml`. No change in `src/domain`, `src/application`, `src/app` or `src/cli`, and no port (test tooling, ADR-001).
- **Systems:** the Neon `ci` branch gets fewer schema creations per run. Nothing changes in `test`, `dev` or `production`.
- **Decisions relied on:** OPS-calidad (testing pyramid, Vitest for integration), OPS-ci-cd (test → build → deploy in GitHub Actions), OPS-ramas-bd, MF-41 design D8 (integration tests run against a branch kept for tests). Contradicts none: the two jobs still both have to pass, and MF-26 adds the deploy after them.
- **Data:** only synthetic test data in test schemas. No nutritionist data, no real user data.
- **Abuses and OWASP:** emptying tables is destructive. Run against the wrong schema it would delete data: A04 Insecure Design, A05 Security Misconfiguration. Mitigation: it only acts on the schema the test database created itself (a generated `test_<seconds>_<hex>` name, never input), never on `public`; a negative test checks that `public` and other schemas keep their rows. The CI split adds no secret and no permission: the new job gets the same `DATABASE_URL_TEST` secret and `contents: read`.
