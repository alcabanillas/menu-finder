# Proposal: Use cases in folders by capability (MF-59.3)

## Why

`src/application/use-cases/` is flat: 18 use cases and their tests sit side by side. ADR-001 §2, point 3, says to subdivide it by capability once it passes about 15 files. The folders were decided by the author when MF-59 was split (`context/roadmap.md`, MF-59.3; `migrate` goes to `ingest/`, decided on 2026-10-12). MF-59.1, MF-59.2 and MF-59.4 already removed the imports between use cases, so the move does not change any dependency, only paths.

## What Changes

- Move each use case, with its test next to it, into one of six folders:
  - `auth/`: `sign-in`, `sign-out`, `current-user`, `create-account`
  - `menu/`: `menu-week-page`, `select-random-menu`, `current-selections`
  - `search/`: `search-menus`, `decompose-request`
  - `shopping-list/`: `shopping-checklist`, `check-shopping-items`
  - `ingest/`: `ingest-menus`, `ingest-recipes`, `ingest-shopping-lists`, `embed-recipes`, `migrate`
  - `evaluation/`: `evaluate-search`, `evaluate-decomposer`
- Update every `@/application/use-cases/<name>` import:
  - the two containers
  - `src/app/_auth/actions.ts`, `planner/actions.ts` and `shopping-list/actions.ts`
  - `src/cli/commands/create-account(.test).ts`
  - the tests' self-imports
- **ADR-001:**
  - §2 tree shows the six folders
  - §6 "Revisar si" applies the threshold to each folder
- **AGENTS.md:** the naming-rule example `use-cases/embed-recipes.ts` becomes `use-cases/ingest/embed-recipes.ts`.
- **No behaviour change:** no route, command, port or stored data changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` in `.openspec.yaml`): files are moved, and no requirement changes.

## Impact

- **Code:** `src/application/use-cases/**`, `src/composition/`, three server actions in `src/app/`, and `src/cli/commands/create-account(.test).ts`.
- **Tooling:** none. The `application` element in `eslint.config.mjs` matches `src/application/*`, so the subfolders stay in the `use-cases` kind, and `checkInternals` still forbids imports between use cases.
- **Docs:** `context/adr/ADR-001-arquitectura-interna.md` §2 and §6, `AGENTS.md`, `context/roadmap.md`.
- **Data:** none.
- **Security and OWASP:** nothing new. The server actions keep the same use cases, with the same session checks; only their import paths change. The e2e tests (login, `/planner`, `/menu`, `/shopping-list`) check that the web still works end to end.
- **Decisions:** ADR-001 §2 point 3 and §3 (MF-59), PROC-sdd.
