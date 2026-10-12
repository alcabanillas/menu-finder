# Proposal: Services for the steps shared between use cases (MF-59.2)

## Why

MF-59.1 made the rule "a use case never imports another use case" verifiable, and left 4 imports on a temporary exception list in `eslint.config.mjs` (`temporaryUseCaseImports`). Each one is a step shared by two use cases, and it needs a port, so it cannot go to `domain/`. The rule decided by the author on 2026-10-11 (`context/roadmap.md`, MF-59) puts those steps in `application/services/`. This change creates the services, deletes the exception list, and leaves the rule with no exceptions.

## What Changes

- **RED:** delete `temporaryUseCaseImports` from `eslint.config.mjs`. `pnpm eslint src` fails with the 4 imports.
- **`selectMenu` → `src/application/services/selection/select-menu.ts`:**
  - It moves with its test, unchanged.
  - `select-random-menu` calls the service.
  - It leaves the `web-container`, because no page calls it. The container test that went through it is deleted, and its case is already in the service's test.
- **`currentShoppingSelection` → `src/application/services/shopping-list/current-shopping-selection.ts`:**
  - It moves out of `shopping-checklist.ts` and gets its own test.
  - `shopping-checklist` and `check-shopping-items` call the service.
- **Search → `src/application/services/search/`:**
  - The body of `searchMenus` becomes the service `findMenus` (`find-menus.ts`). Its tests move with it.
  - The use case `search-menus` delegates to `findMenus`. The CLI still calls the use case through the `cli-container`.
  - `evaluate-search` calls `findMenus`.
- **Decomposition → `src/application/services/search/`:**
  - The body of `decomposeRequest` becomes the service `decomposeText` (`decompose-text.ts`). Its tests and `MAX_REQUEST_LENGTH` move with it.
  - The use case `decompose-request` delegates to `decomposeText`.
  - `evaluate-decomposer` calls `decomposeText`.
- **ADR-001 §2:** add `services/` to the tree, with one line on what goes there.
- **No behaviour change:** no route, command, port or stored data changes. The only change visible from outside is that the `web-container` no longer exposes `selectMenu`. Nothing called it.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None (`skip_specs: true` in `.openspec.yaml`): this is a refactor, and no requirement changes.

## Impact

- **Code:**
  - `src/application/services/` (new)
  - `src/application/use-cases/`: `select-menu` (moved out), `select-random-menu`, `shopping-checklist`, `check-shopping-items`, `search-menus`, `decompose-request`, `evaluate-search`, `evaluate-decomposer`, and their tests
  - `src/composition/web-container(.test).ts`
- **Tooling:** `eslint.config.mjs` (deletes the use-case exception list; the DTO list for MF-59.4 stays).
- **Docs:** `context/adr/ADR-001-arquitectura-interna.md` §2.
- **Data:** none. No user, menu or nutritionist data is read or written.
- **Security and OWASP:**
  - A04 Insecure Design: the validation of untrusted input does not move away from the server. `positiveIntegerInput` in `selectMenu`, `parseSearchRequest` in `findMenus` and the length limits in `decomposeText` move with their negative tests.
  - A01 Broken Access Control: removing `selectMenu` from the `web-container` removes an entry point that nothing called. `selectRandomMenu` still takes the user id from the session only.
  - Possible abuse: none new. No endpoint or command changes.
- **Decisions:** ADR-001 §3 (use cases and services, MF-59), PROC-tdd and PROC-sdd. The change carries out MF-59.2 in `context/roadmap.md`.
