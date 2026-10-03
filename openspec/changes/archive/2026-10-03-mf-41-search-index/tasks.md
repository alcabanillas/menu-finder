## 1. Checks before coding

- [x] 1.1 The author reviews the decisions D2, D3 and D5 of `design.md` (driver, migrations, embeddings) and confirms or changes them; verify: the confirmation is in the chat and `design.md` is updated if anything changed
- [x] 1.2 Check on npm and in the Genkit documentation the package names (PostgreSQL driver, `genkit`, its Google plugin), the embedding call, how the task prefix of `gemini-embedding-2` is passed and the environment variable the plugin reads; verify: the exact names are written in `design.md` D5 and each package exists, is maintained and is the one intended (`context/safety-first.md` §2.5)
- [x] 1.3 On a temporary Neon branch (created with an expiry), run `CREATE EXTENSION vector`; verify: it succeeds, and the branch is deleted afterwards
- [x] 1.4 **Redesign decided by the author (2026-10-01): the database goes behind the existing `MenuRepository` and `RecipeRepository` ports**, as the MF-11 and MF-38 proposals said ("MF-16 replaces it with the database adapter without touching the use case"). The first version of this change (`DatasetSource`, `SearchIndexWriter`, `loadSearchIndex`) is replaced. The author reviews the rewritten proposal, design (D1, D9) and specs, including the names of the new ports, use cases and adapters; verify: the confirmation is in the chat (2026-10-01: names and the partial menu save confirmed)
  - **Both destinations, decided:** JSON first, then Postgres, through an adapter per port that calls the two repositories in order. When Postgres fails, the command exits 1 and says that the JSON was written and why the database save failed; running it again writes both.
  - **Embeddings, decided:** a separate use case and command, `pnpm ingest embed`, that reads the recipe rows from the database and only sends new or changed texts to Gemini. `ingestRecipes` does not change.
  - **Command order, decided:** `ingest recipes` → `ingest menu` → `ingest embed`. The foreign key `menu_dish.recipe_key` → `recipe` stays; a menu with a dish whose recipe is not in the database is not saved, and the error names the menu, the dish and the file.
  - **Repository contract, already decided:** a save upserts and never removes what it did not receive (ING-cli-local; MF-11 design, archive `2026-09-27-mf-11-migrar-parser-menu-cli/design.md`). The first spec of this change, which removed rows no longer in the files, was wrong.
  - **PDF → database is the real load, decided:** no `load` command and no read method on the repository ports. The JSON is still written for the golden-set scripts and for working locally, and is never read back into the database. Corrections by hand in the JSON (SEG-roles) are dropped for now.

## 2. Dependencies

- [x] 2.1 Add the packages of 1.2 and the type definitions they need; verify: `pnpm install --frozen-lockfile`, `pnpm typecheck` and the OSV scan of the CI pass, and `pnpm-workspace.yaml` needs no new install-script permission (or the one added is justified) (2026-10-01: install, typecheck and a Genkit load test pass; `pnpm audit` reports the four accepted advisories, ignored with reasons in `osv-scanner.toml`; the CI OSV scan is confirmed on the PR)

## 3. Remove the first version

- [x] 3.1 Delete `DatasetSource`, `SearchIndexWriter`, `loadSearchIndex`, the `load` command and their DTO, adapters and tests; verify: `pnpm typecheck` passes once the next groups are in place, and `grep` finds none of the removed names in `src/`

## 4. Application: ports and use cases with fakes (tests first)

- [x] 4.1 Add the `RecipeEmbeddingRepository` port (`documents(variant)`, `saveAll(variant, embeddings)`); verify: `pnpm typecheck` passes, and `MenuRepository`, `RecipeRepository` and the tests of `ingestMenus` and `ingestRecipes` are unchanged
- [x] 4.2 Write the `embedRecipes` tests: one text per recipe row, the rows of dishes without recipe included; the text has title and ingredients and no preparation; an unchanged text with the same model is not sent; a changed ingredient sends one text; a different model sends all; a failing service writes nothing; verify: they fail, then pass with `use-cases/embed-recipes`
- [x] 4.3 Write the `migrate` tests with a fake runner: applies the pending ones in order, nothing when all are applied; verify: they fail, then pass with `use-cases/migrate`
- [x] 4.4 Run `pnpm test:coverage`; verify: the new use cases are at 100 %

## 5. Infrastructure

- [x] 5.1 Write the schema check test (against a temporary Neon branch, `DATABASE_URL_TEST`): the extension and the six tables exist, **every** table has row-level security, a second run applies nothing, a failing migration leaves nothing; verify: it fails with no migration, then passes with `001-search-schema.sql` and the runner
- [x] 5.2 Write the `PostgresRecipeRepository` tests on the temporary branch: a recipe with its ingredients and preparation in order, saving again replaces it, a recipe not received is kept; verify: they fail, then pass
- [x] 5.3 Write the `PostgresMenuRepository` tests on the temporary branch: a menu with its meals and dishes in their positions, a dish without recipe makes one name-only row per name, saving a menu again replaces its dishes and keeps the other menus, a dish whose recipe is missing leaves its menu unsaved and the others saved; verify: they fail, then pass
- [x] 5.4 Write the `PostgresRecipeEmbeddingRepository` tests on the temporary branch: `documents` returns every recipe row, the name-only ones included, with its stored model and text when there is one; `saveAll` upserts in one transaction; verify: they fail, then pass
- [x] 5.5 Write the fan-out adapter tests with fake repositories: JSON first, then the database; a JSON error stops before the database; a database error says that the JSON was written and why the database save failed; verify: they fail, then pass with `infrastructure/fan-out/`
- [x] 5.6 Write the Genkit `EmbeddingsPort` adapter test with the Genkit call replaced: document task prefix, model and dimensions returned, error text without the key; verify: it fails, then passes with `infrastructure/genkit/`
- [x] 5.7 Verify in the Neon project that the Data API is still off and Neon Auth is off after the migration (`get_data_api` and `get_auth` answer "not found"); verify: recorded in the change notes (2026-10-01, after `migrate` on `production` br-shiny-cherry-b1xeivym: `get_data_api` → 404 "data api not found"; `get_auth` → 404 "Neon Auth is not enabled for this branch")

## 6. CLI and composition

- [x] 6.1 Write the CLI tests with a fake container for `embed`: extra arguments give the usage and exit 2 and read nothing, a missing variable exits 1 naming it and does not connect, a driver error that contains the connection string is printed without credentials; and for `menu` and `recipes`, a missing `DATABASE_URL_UNPOOLED` exits 1 before parsing; verify: they fail, then pass with `cli/commands/*` and `run-cli`
- [x] 6.2 Wire the adapters in `composition/cli-container.ts`: fan-out repositories for `menu` and `recipes`, Postgres and Genkit for `embed`; verify: `pnpm typecheck`, `pnpm lint` (the boundary rules) and `pnpm test:run` pass

## 7. Run it for real

- [x] 7.1 Run `pnpm ingest migrate`; verify: it prints the applied migration and a second run prints none
- [x] 7.2 Run `pnpm ingest recipes`, `pnpm ingest menu` and `pnpm ingest embed` against `production`; verify: 36 menus, 504 meals, 608 menu dishes and 434 recipes plus the 14 name-only rows are in the database, with one embedding each, and a second `embed` makes no embedding call (2026-10-01 on `production` br-shiny-cherry-b1xeivym: `recipes` and `menu` exit 0, `embed` "448 recipe rows: 0 computed, 448 kept"; SQL count: 36 menus, 504 meals, 608 dishes, 434 recipes, 14 name-only rows, 448 embeddings, 0 rows without embedding)
- [x] 7.3 Commit nothing from `data/`; verify: `git status` shows only source files (2026-10-01: nothing under `data/`)

## 8. Close

- [x] 8.1 Update `context/decisiones.md` (D2, D3 and D5; SEG-roles without the corrections in the JSON; ARQ-modelo-datos with the subset created and its natural keys), `context/roadmap.md` (MF-41 done, with the archive link) and `context/tareas/T0-extraccion-previa.md` (the order `recipes` → `menu` → `embed`, and the `migrate` command); verify: `grep` of the task and decision codes and a read of the changed lines (2026-10-01: `decisiones.md` ARQ-modelo-datos, ING-menu-json, ING-cli-local, ING-trazabilidad and SEG-roles, T0 and T2 updated; 2026-10-03: `roadmap.md` MF-41 done with the archive link)
- [x] 8.2 Go through the checklist in `context/safety-first.md` §4 before archiving and record the result; verify: the answers are written at the end of this file
- [ ] 8.3 After the merge to `main`, dismiss the five Dependabot alerts of Genkit's dependencies (four advisories: GHSA-q7rr-3cgh-j5r3 appears for both `@opentelemetry/sdk-node` and `@opentelemetry/auto-instrumentations-node`; GHSA-45rx-2jwx-cxfr, GHSA-8988-4f7v-96qf, GHSA-w5hq-g745-h8pq) in GitHub with the reason "Vulnerable code is not actually used" and a link to the section "Accepted risk: vulnerable transitive dependencies of Genkit" of `openspec/changes/archive/2026-10-03-mf-41-search-index/proposal.md` (author, by hand); verify: the Dependabot alert list has no open alert

## Checklist `context/safety-first.md` §4 (2026-10-01)

- **Business and security decisions in the backend:** yes. Everything runs in the local CLI and the hexagon; there is no web code in this change.
- **Endpoints (auth, permissions, input shape, negative authorization tests in CI), user from the session, minimal data returned:** not applicable. No endpoint and no user; the CLI prints counts and, on error, the menu, dish and file to fix.
- **No secret hard-coded or in the diff:** yes. The diff was scanned for Neon passwords, Google API keys and URLs with credentials; only the fake ones of the tests appear. The connection strings and the key come from `.env.local` (git-ignored); the test branch URL was kept outside the repository.
- **Each new dependency checked and justified:** yes, task 1.2 and `design.md` D5 (`pg`, `@types/pg`, `genkit`, `@genkit-ai/google-genai`). The four accepted advisories of Genkit are in the proposal and `osv-scanner.toml`. No install script is enabled: the two that pnpm asked about are ignored in `pnpm-workspace.yaml`. On 2026-10-03 three development dependencies were added for the lint (`knip`, `eslint-plugin-jsdoc`, `@stylistic/eslint-plugin`); each was checked on npm: the official repository of its project, published in the last month.
- **Parameterised queries:** yes. Every value goes in as a bind parameter or as one JSON parameter expanded by `jsonb_to_recordset`. The only interpolated SQL is the schema name of the test helper (`test-database.ts`), generated from random hex, with a comment.
- **Unexpected input values:** yes for the database writes: `postgres-menu-repository.test.ts` stores names with SQL metacharacters, quotes, backslashes, `$1`, emoji, a zero-width space and an empty string, and reads them back unchanged. Nothing of this change reaches an LLM prompt; the embedding service gets data, not instructions.
- **Sensitive actions logged:** not applicable (no login, no access control in this change).
- **Deviations from a DEBE rule:**
  - §2.3 `sslmode=verify-full`: `.env.local` uses `sslmode=require`, which `pg` 8 treats as `verify-full` (it prints a warning saying so), so the certificate and host name are verified today. With `pg` 9 `require` will become weaker; the author chose on 2026-10-01 not to change `.env.local` now. To be revisited before upgrading `pg`.
  - §2.4 Gemini key restricted to the Gemini API with a spend alert: not verifiable from the repository; it is in the author's Google Cloud project.
  - §2.4 owner role: used only by the CLI (ingestion, embeddings, migrations), as the rule allows; the web gets its own role in MF-17/MF-20.
