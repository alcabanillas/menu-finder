# Proposal: A DTO never imports a port (MF-59.4)

## Why

MF-59.1 wrote the rule "a DTO never imports a port" (decided by the author on 2026-10-12): a DTO is the shape the consumer sees, and the use case translates the port errors into it. Six DTOs broke it with 10 imports. MF-59.1 put them on a temporary exception list in `eslint.config.mjs`. This change removes that list.

The roadmap left one question open: may a port import a DTO? The author decided on 2026-10-12 that it may. The dependency stays inside `application/` and goes the right way: the port depends on a shape, and the shape knows nothing about the port. Forbidding it would force duplicating `constraintSchema` (zod cannot go to `domain/`), or would move shapes that the CLI and the web need into the ports, where those adapters cannot see them.

## What Changes

- **RED:** delete the temporary DTO block in `eslint.config.mjs`. `pnpm eslint src` fails with the 10 imports.
- **Concepts move to `domain/`:**
  - `QueryType` → `src/domain/evaluation/query-type.ts`
  - `LayoutAnomaly` → `src/domain/recipe/layout-anomalies.ts`, next to `content-anomalies.ts`
  - `ShoppingListAnomaly` → `src/domain/shopping/shopping-list-anomalies.ts`

  The ports and the adapters import them from there.
- **Port errors get their own DTO failure types, with the same shape:**
  - `SourceFailure` and `SaveFailure` go in the new `src/application/dto/ingest-failure.ts`. They are used by `ingest-menus`, `ingest-recipes` and `ingest-shopping-lists`.
  - `EmbedRecipesError` lists its own two failures, `embedding-failed` and `store-failed`.
  - `MigrateError` lists its own `migration-failed`.

  The use case is where a port error becomes a DTO failure. The compiler checks that the two shapes stay compatible, so a change in a port error breaks the use case, not the CLI.
- **ADR-001 §3:** a port may import DTOs; a DTO never imports a port.
- **No behaviour change:** the kinds and fields stay the same, so the CLI output does not change.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` in `.openspec.yaml`): types only, and no requirement changes.

## Impact

- **Code:**
  - `src/application/dto/`: `embed-recipes`, `evaluation-report`, `ingest-menus`, `ingest-recipes`, `ingest-shopping-lists`, `migrate`, and the new `ingest-failure`
  - `src/application/ports/`: `document-source`, `golden-set-source`
  - `src/domain/`: `evaluation/`, `recipe/`, `shopping/`
  - the infrastructure files that import the anomaly types
  - `src/cli/describe-source-error.ts`, if it can now use `SourceFailure` directly
- **Tooling:** `eslint.config.mjs`. The DTO exception list is deleted, so MF-59 leaves no temporary exception.
- **Docs:** `context/adr/ADR-001-arquitectura-interna.md` §3 and `context/roadmap.md` (MF-59.4).
- **Data:** none.
- **Security and OWASP:**
  - Types only. No runtime code, endpoint, command or input changes.
  - Possible abuse: none.
  - Error reasons keep going through `redactSecrets` in the CLI as before.
- **Decisions:** ADR-001 §3 (MF-59), PROC-sdd. Ports → DTO is allowed (decided by the author on 2026-10-12).
