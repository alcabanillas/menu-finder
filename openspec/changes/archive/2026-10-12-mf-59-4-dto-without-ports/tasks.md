# Tasks: MF-59.4 A DTO never imports a port

Types only, about 15 files. One agent, sequentially. Parallel tracks would share `document-source.ts` and the ingest DTOs.

## 1. The rule without exceptions, seen failing

- [x] 1.1 RED. Delete the temporary DTO block ("Temporary: MF-59.4 …") from `eslint.config.mjs`. Run `pnpm eslint src`. Verify: exactly 10 `boundaries/dependencies` errors, all in the 6 DTOs listed in design.md.

## 2. Domain concepts

- [x] 2.1 Move `QueryType` to `src/domain/evaluation/query-type.ts`, `LayoutAnomaly` to `src/domain/recipe/layout-anomalies.ts` and `ShoppingListAnomaly` to `src/domain/shopping/shopping-list-anomalies.ts`. Keep each JSDoc.
- [x] 2.2 Point every importer to `domain/` (design.md D3): `document-source.ts`, `golden-set-source.ts`, `evaluation-report.ts`, `ingest-recipes.ts`, `ingest-shopping-lists.ts`, `recipe-page(.test).ts`, `shopping-list-page.ts`, `evaluate-search.test.ts`, and any other file that `pnpm typecheck` names. Verify: `pnpm typecheck` passes.

## 3. DTO failures

- [x] 3.1 Create `src/application/dto/ingest-failure.ts` with `SourceFailure` and `SaveFailure` (design.md D2). Use them in `ingest-menus.ts`, `ingest-recipes.ts` and `ingest-shopping-lists.ts` in place of `SourceError` and `RepositoryError`.
- [x] 3.2 In `embed-recipes.ts`, write `EmbedRecipesError` as its own union, `{ kind: 'embedding-failed'; reason: string } | { kind: 'store-failed'; reason: string }`. In `migrate.ts`, write `MigrateError` as `{ kind: 'migration-failed'; migration: string | null; reason: string; applied: string[] }`.
- [x] 3.3 In `src/cli/describe-source-error.ts`, import `SourceFailure` and drop the `MenuFailure['error']` alias.
- [x] 3.4 GREEN. `pnpm lint` passes. `Select-String -Path src/application/dto/*.ts -Pattern "application/ports"` finds nothing, and `eslint.config.mjs` has no block marked "Temporary".

## 4. Docs and checks

- [x] 4.1 ADR-001 §3, MF-59 paragraph: a port may import DTOs (decided by the author on 2026-10-12). `context/roadmap.md`: mark MF-59.4 as done and replace "Queda abierto si un puerto puede importar DTOs" with the decision.
- [x] 4.2 `pnpm typecheck` and `pnpm test:coverage` pass, with the same test count (1321).
- [x] 4.3 Commit `refactor(application): a DTO never imports a port (MF-59.4)`. No PR: one PR for the whole of MF-59.

## Safety review (`context/seguridad/safety-first.md` §4)

- Types only: no endpoint, command, query, input or runtime code changes. The auth, permissions, validation, SQL and logging items do not apply.
- Error reasons keep reaching the CLI through `redactSecrets`, as before; no field is added to what is printed.
- No secret in the diff, and no new dependency.
- No deviation from a MUST rule.
