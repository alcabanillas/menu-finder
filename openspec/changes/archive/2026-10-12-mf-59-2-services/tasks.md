# Tasks: MF-59.2 Services for the steps shared between use cases

Execution model (design.md D5):
- **Phase 1** runs alone, before the rest.
- **Phase 2** has four tracks, A, B, C and D. They run in parallel, one Haiku subagent each, in the same working tree.
- **Phase 3** runs alone, after all four tracks finish.

Rules for every Phase 2 subagent:
- Edit only the files listed under "May touch". Never touch the files listed under "Must not touch", nor any file of another track.
- Move code and tests; do not rewrite them. Keep each test's name and assertions. Change only import paths and the function names that design.md D2 renames.
- Order each file top-down (AGENTS.md: short functions, most important first): imports, types and constants, the exported function, then its helpers in call order.
- Run only the scoped commands given in each task. Never run `pnpm lint`, `pnpm test`, `pnpm typecheck` or `pnpm install`.
- Never commit, stage, stash or switch branch.
- When done, report the commands you ran with their pass or fail output, and the list of files you changed.

## 1. Phase 1 — The rule without exceptions, seen failing (sequential)

- [x] 1.1 RED. Delete `temporaryUseCaseImports` and its spread (`...temporaryUseCaseImports,`) from `eslint.config.mjs`. Keep `fromApplicationPart` and the DTO block for MF-59.4. Run `pnpm eslint src`. Verify: exactly 4 `boundaries/dependencies` errors, in `select-random-menu.ts`, `check-shopping-items.ts`, `evaluate-search.ts` and `evaluate-decomposer.ts`.

## 2. Phase 2, track A — selection (Haiku, parallel with B, C and D)

**May touch:**
- `src/application/use-cases/`: `select-menu.ts` and `select-menu.test.ts` (moved out), `select-random-menu.ts`, `select-random-menu.test.ts`
- `src/application/services/selection/` (new)
- `src/composition/web-container.ts`, `src/composition/web-container.test.ts`

**Must not touch:** `eslint.config.mjs`, `cli-container.ts`, and any file of tracks B, C or D.

- [x] 2.1 Move `select-menu.ts` and `select-menu.test.ts` with `git mv` to `src/application/services/selection/`. Point the test's import to `@/application/services/selection/select-menu`. Verify: `pnpm vitest run src/application/services/selection` passes.
- [x] 2.2 In `select-random-menu.ts` (and its test, if it imports `select-menu`), import `selectMenu` from `@/application/services/selection/select-menu`. Verify: `pnpm vitest run src/application/use-cases/select-random-menu.test.ts` passes, and `pnpm eslint src/application/use-cases/select-random-menu.ts` reports no error.
- [x] 2.3 In `web-container.ts`, remove the `selectMenu` key (L66) and the two imports of `select-menu` (L5, L13). In `web-container.test.ts`, delete the test "refuses an invalid menu number before reaching the database" (design.md D4). Verify: `pnpm vitest run src/composition/web-container.test.ts` passes, and `pnpm eslint src/composition/web-container.ts src/composition/web-container.test.ts` reports no error.

## 3. Phase 2, track B — shopping list (Haiku, parallel with A, C and D)

**May touch:**
- `src/application/use-cases/`: `shopping-checklist.ts`, `check-shopping-items.ts`
- `src/application/services/selection/` (new)

**Must not touch:** `eslint.config.mjs`, `src/composition/`, and any file of tracks A, C or D.

- [x] 3.1 RED. Create `src/application/services/selection/current-shopping-selection.test.ts`. Base its fakes on those in `src/application/use-cases/shopping-checklist.test.ts`. Write three tests for `currentShoppingSelection` from `@/application/services/selection/current-shopping-selection`: it returns `null` when the user has no current shopping list; it returns the selection whose list is current; and it returns the read error when `listFrom` fails. Verify: `pnpm vitest run src/application/services/selection` fails because the module is missing.
- [x] 3.2 GREEN. Move `currentShoppingSelection` from `shopping-checklist.ts` into `src/application/services/selection/current-shopping-selection.ts`. Its `Deps` is `{ selections: SelectionRepository; clock: Clock }`. Take with it the imports it needs, and remove from `shopping-checklist.ts` the imports it no longer uses. Import the service in `shopping-checklist.ts` and `check-shopping-items.ts`. Verify: `pnpm vitest run src/application/services/selection src/application/use-cases/shopping-checklist.test.ts src/application/use-cases/check-shopping-items.test.ts` passes, and `pnpm eslint src/application/services/selection src/application/use-cases/shopping-checklist.ts src/application/use-cases/check-shopping-items.ts` reports no error.

## 4. Phase 2, track C — search (Haiku, parallel with A, B and D)

**May touch:**
- `src/application/use-cases/`: `search-menus.ts`, `search-menus.test.ts`, `evaluate-search.ts`, `evaluate-search.test.ts`
- `src/application/services/search/`: `find-menus.ts`, `find-menus.test.ts` (new)

**Must not touch:** `eslint.config.mjs`, `src/composition/`, `src/cli/`, the decomposition files of track D, and any file of tracks A or B.

- [x] 4.1 Move the body of `search-menus.ts` with `git mv` to `src/application/services/search/find-menus.ts`, and its test to `find-menus.test.ts` next to it. Rename `searchMenus` to `findMenus` and `SearchMenusDeps` to `FindMenusDeps`, in the code and in the test (design.md D2). Keep `INDEX_NOT_LOADED` and every helper there. Verify: `pnpm vitest run src/application/services/search/find-menus.test.ts` passes with the same number of tests as `search-menus.test.ts` had.
- [x] 4.2 RED. Create a new `src/application/use-cases/search-menus.test.ts` with one test: with `menus.list` failing, `searchMenus(dto, 'lexical', deps)` returns the same `search-failed` result as `findMenus` with the same input. Verify: it fails because `search-menus.ts` is missing.
- [x] 4.3 GREEN. Create `src/application/use-cases/search-menus.ts`. Export `searchMenus(dto, strategy, deps: FindMenusDeps)`, which returns `findMenus(dto, strategy, deps)`, with a JSDoc line that says it is the entry the adapters call (design.md D1). Verify: `pnpm vitest run src/application/use-cases/search-menus.test.ts` passes.
- [x] 4.4 In `evaluate-search.ts`, import `findMenus` and `FindMenusDeps` from `@/application/services/search/find-menus`, and replace `searchMenus` and `SearchMenusDeps`. Do the same in `evaluate-search.test.ts` if it imports them. Verify: `pnpm vitest run src/application/use-cases/evaluate-search.test.ts` passes, and `pnpm eslint src/application/use-cases/search-menus.ts src/application/use-cases/evaluate-search.ts src/application/services/search/find-menus.ts` reports no error.

## 5. Phase 2, track D — decomposition (Haiku, parallel with A, B and C)

**May touch:**
- `src/application/use-cases/`: `decompose-request.ts`, `decompose-request.test.ts`, `evaluate-decomposer.ts`, `evaluate-decomposer.test.ts`
- `src/application/services/search/`: `decompose-text.ts`, `decompose-text.test.ts` (new)

**Must not touch:** `eslint.config.mjs`, `src/composition/`, `src/cli/`, the files of track C in `services/search/`, and any file of tracks A or B.

- [x] 5.1 Move `decompose-request.ts` with `git mv` to `src/application/services/search/decompose-text.ts`, and its test to `decompose-text.test.ts` next to it. Rename `decomposeRequest` to `decomposeText` and `DecomposeRequestDeps` to `DecomposeTextDeps`, in the code and in the test. `MAX_REQUEST_LENGTH` stays with the service (design.md D2). Verify: `pnpm vitest run src/application/services/search/decompose-text.test.ts` passes with the same number of tests as `decompose-request.test.ts` had.
- [x] 5.2 RED. Create a new `src/application/use-cases/decompose-request.test.ts` with one test: `decomposeRequest('   ', { decomposer })` returns `request-too-short`, the same result as `decomposeText`, and does not call the decomposer. Verify: it fails because `decompose-request.ts` is missing.
- [x] 5.3 GREEN. Create `src/application/use-cases/decompose-request.ts`. Export `decomposeRequest(request, deps: DecomposeTextDeps)`, which returns `decomposeText(request, deps)`, with a JSDoc line that says it is the entry the adapters call (design.md D1). Verify: `pnpm vitest run src/application/use-cases/decompose-request.test.ts` passes.
- [x] 5.4 In `evaluate-decomposer.ts`, import `decomposeText` from `@/application/services/search/decompose-text`, and replace `decomposeRequest`. Do the same in `evaluate-decomposer.test.ts` if it imports it. Verify: `pnpm vitest run src/application/use-cases/evaluate-decomposer.test.ts` passes, and `pnpm eslint src/application/use-cases/decompose-request.ts src/application/use-cases/evaluate-decomposer.ts src/application/services/search/decompose-text.ts` reports no error.

## 6. Phase 3 — Integration (sequential)

- [x] 6.1 `git diff --stat` and `git status`: each track stayed in its files. The test count moves only as design.md Risks says (−1 container test, +2 delegation tests, +3 `currentShoppingSelection` tests).
- [x] 6.2 GREEN. `pnpm lint` passes with no `boundaries/dependencies` error, and `Select-String -Path src/application/use-cases/*.ts -Pattern "from '@/application/use-cases/"` finds only test self-imports.
- [x] 6.3 Check the Resultado: add a temporary import from `search-menus` into `select-random-menu.ts`, run `pnpm eslint src/application/use-cases/select-random-menu.ts`, see it fail, and remove the import.
- [x] 6.4 `context/adr/ADR-001-arquitectura-interna.md` §2: add `services/` to the tree of `application/`, with one line saying it holds the steps shared between use cases (MF-59). In `context/roadmap.md`, mark MF-59.2 as done.
- [x] 6.5 `pnpm typecheck`, `pnpm test:coverage` (100 % in `application/**` and `domain/**`) and `knip` pass.
- [x] 6.6 Commit `refactor(application): services for the steps shared between use cases (MF-59.2)`. No PR: one PR for the whole of MF-59 (decided by the author on 2026-10-12).

## Safety review (`context/seguridad/safety-first.md` §4)

- No new endpoint, command, query or input: the auth, permissions, data minimisation, SQL and logging items do not apply.
- Validation stays on the server: `positiveIntegerInput` in `selectMenu`, `parseSearchRequest` in `findMenus` and the length limits in `decomposeText` moved together with their negative tests.
- Removing `selectMenu` from the `web-container` removes an entry point that nothing called; `selectRandomMenu` still takes the user id from the session only.
- No secret in the diff, and no new dependency.
- No deviation from a MUST rule.
