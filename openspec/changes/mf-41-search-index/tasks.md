## 1. Checks before coding

- [x] 1.1 The author reviews the decisions D2, D3 and D5 of `design.md` (driver, migrations, embeddings) and confirms or changes them; verify: the confirmation is in the chat and `design.md` is updated if anything changed
- [x] 1.2 Check on npm and in the Genkit documentation the package names (PostgreSQL driver, `genkit`, its Google plugin), the embedding call, how the task prefix of `gemini-embedding-2` is passed and the environment variable the plugin reads; verify: the exact names are written in `design.md` D5 and each package exists, is maintained and is the one intended (`context/safety-first.md` §2.5)
- [x] 1.3 On a temporary Neon branch (created with an expiry), run `CREATE EXTENSION vector`; verify: it succeeds, and the branch is deleted afterwards

## 2. Dependencies

- [x] 2.1 Add the packages of 1.2 and the type definitions they need; verify: `pnpm install --frozen-lockfile`, `pnpm typecheck` and the OSV scan of the CI pass, and `pnpm-workspace.yaml` needs no new install-script permission (or the one added is justified) (2026-10-01: install, typecheck and a Genkit load test pass; `pnpm audit` reports the four accepted advisories, ignored with reasons in `osv-scanner.toml`; the CI OSV scan is confirmed on the PR)

## 3. Application: use cases with fake ports (tests first)

- [x] 3.1 Write the `loadSearchIndex` tests: validation of both inputs (missing, not JSON, wrong shape, dish with an unknown recipe file) leaves the writer untouched, the text sent to the embedding fake has title and ingredients and no preparation, a failing embedding keeps the writer's state, an unchanged second run makes no embedding call, one changed recipe recomputes one embedding, a dish without recipe makes one name-only row per name; verify: they fail, then pass with `use-cases/load-search-index`
- [x] 3.2 Write the `migrate` tests with a fake runner: applies the pending ones in order, nothing when all are applied; verify: they fail, then pass with `use-cases/migrate`
- [x] 3.3 Run `pnpm test:coverage`; verify: the new use cases and DTOs are at 100 %

## 4. Infrastructure

- [x] 4.1 Write the schema check test (against a temporary Neon branch, `DATABASE_URL_TEST`): the extension and the six tables exist, **every** table has row-level security, a second run applies nothing, a failing migration leaves nothing; verify: it fails with no migration, then passes with `001-search-schema.sql` and the runner
- [x] 4.2 Write the `SearchIndexWriter` adapter tests on the temporary branch: the whole load in one transaction, a failure half-way changes nothing, a removed recipe disappears with its ingredients and embedding, an unchanged embedding is kept; verify: they fail, then pass
- [x] 4.3 Write the Genkit `EmbeddingsPort` adapter test with the Genkit call replaced: document task prefix, model and dimensions returned, error text without the key; verify: it fails, then passes with `infrastructure/genkit/`
- [x] 4.4 Write the `DatasetSource` adapter tests with temporary files: missing file names the file and the generating command, not-JSON and wrong shape name the first invalid path; verify: they fail, then pass with `infrastructure/json-file/`
- [x] 4.5 Verify in the Neon project that the Data API is still off and Neon Auth is off after the migration (`get_data_api` and `get_auth` answer "not found"); verify: recorded in the change notes (2026-10-01, after `migrate` on `production` br-shiny-cherry-b1xeivym: `get_data_api` → 404 "data api not found"; `get_auth` → 404 "Neon Auth is not enabled for this branch")

## 5. CLI and composition

- [x] 5.1 Write the CLI tests with a fake container for `migrate` and `load`: extra arguments give the usage and exit 2 and read nothing, a missing variable exits 1 naming it and does not connect, a driver error that contains the connection string is printed without credentials; verify: they fail, then pass with `cli/commands/*` and `run-cli`
- [x] 5.2 Wire the adapters in `composition/cli-container.ts`; verify: `pnpm typecheck`, `pnpm lint` (the boundary rules) and `pnpm test:run` pass

## 6. Run it for real

- [x] 6.1 Run `pnpm ingest migrate`; verify: it prints the applied migration and a second run prints none
- [x] 6.2 Run `pnpm ingest load`; verify: 36 menus, 504 meals, 608 menu dishes and 434 recipes plus the 14 name-only rows are in the database, with one embedding each, and a second run makes no embedding call
- [x] 6.3 Commit nothing from `data/`; verify: `git status` shows only source files

## 7. Close

- [ ] 7.1 Update `context/decisiones.md` (D2, D3 and D5 once confirmed in 1.1; ARQ-modelo-datos with the subset created), `context/roadmap.md` (MF-41 done, with the archive link) and `context/tareas/T0-extraccion-previa.md` (the `migrate` and `load` commands); verify: `grep` of the task and decision codes and a read of the changed lines
- [ ] 7.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result; verify: the answers are written at the end of this file
- [ ] 7.3 After the merge to `main`, dismiss the four Dependabot alerts of Genkit's dependencies (GHSA-q7rr-3cgh-j5r3, GHSA-45rx-2jwx-cxfr, GHSA-8988-4f7v-96qf, GHSA-w5hq-g745-h8pq) in GitHub with the reason "Vulnerable code is not actually used" and a link to the accepted-risk section of `proposal.md` (author, by hand); verify: the Dependabot alert list has no open alert
