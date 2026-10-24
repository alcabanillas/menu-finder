# Tasks: MF-59.1 Dependency rule between use cases, and cleanup without ports

Execution model (design.md D9):
- **Phase 1** runs alone, before the rest. Do not give it to Haiku: it needs judgement on the ESLint config.
- **Phase 2** has three tracks, A, B and C. They run in parallel, one Haiku subagent each, in the same working tree.
- **Phase 3** runs alone, after all three tracks finish.

Rules for every Phase 2 subagent:
- Edit only the files listed under "May touch". Never touch the files listed under "Must not touch", nor any file of another track.
- Move code and tests; do not rewrite them. Keep each test's name and assertions. Change only import paths, and the call site where a task says so.
- Run only the scoped commands given in each task. Never run `pnpm lint`, `pnpm test`, `pnpm typecheck` or `pnpm install`: while the other tracks are in flight, those commands show their errors.
- Never commit, stage, stash or switch branch.
- When done, report the commands you ran with their pass or fail output, and the list of files you changed.

## 1. Phase 1 — The rule, seen failing (sequential)

- [x] 1.1 Add `eslint-plugin-import` as a devDependency, at the same major and minor version that `eslint-config-next` resolves (2.32.x), with `pnpm add -D`. Verify: `pnpm ls eslint-plugin-import --depth 0` lists it as a direct devDependency.
- [x] 1.2 In `eslint.config.mjs`, split the `application` policy by `kind` as in design.md D1, set `checkInternals: true` in `dependencyRule`, and add the tests policy from design.md D2 to `architectureTests`. Then enable `import/no-cycle` on `src/**/*.{ts,tsx}`, reusing the `import` plugin that `eslint-config-next` registers (design.md D3). Verify: `pnpm eslint eslint.config.mjs` loads with no config error.
- [x] 1.3 RED. Run `pnpm eslint src scripts` and save the output to the scratchpad. Verify: the run has exactly 12 `boundaries/dependencies` errors, one per import in design.md (the list in the proposal, plus the 8 that tracks A–C remove), and 0 `import/no-cycle` errors. Errors from the test self-imports or from other elements mean the policy is wrong: fix it here, before Phase 2.
  - Found while running the suite: `src/infrastructure/auth/account-creation-boundary.test.ts` lints paths that are not on disk, and `import/no-cycle` crashes on them. That test now turns `import/no-cycle` off, since it only checks the layer rules.
- [x] 1.4 In `vitest.config.mts`, remove `'src/application/dto/**'` from `coverage.exclude` (decided by the author on 2026-10-12). Verify: `pnpm vitest run --coverage src/application/dto` reports the files in `dto/`, and only those with runtime code have statements.

## 2. Phase 2, track A — search (Haiku, parallel with B and C)

**May touch:**
- `src/application/use-cases/` → `search-menus.ts`, `search-menus.test.ts`, `embed-recipes.ts`, `embed-recipes.test.ts`, `decompose-request.ts`, `evaluate-search.ts`, `evaluate-decomposer.ts`
- `src/application/dto/` → `search-request.ts`, `search-request.test.ts` (new)
- `src/domain/search/` → `embedding-text.ts`, `embedding-text.test.ts`, `ranking-metrics(.test).ts`, `decomposition-score(.test).ts` (the last two are moved out)
- `src/domain/evaluation/` (new)
- `scripts/evaluacion/similarity-floor.ts`

**Must not touch:** `eslint.config.mjs`, `vitest.config.mts`, `package.json`, `src/composition/`, and any file of tracks B or C.

- [x] 2.1 RED. In `src/domain/search/embedding-text.test.ts`, add a test that imports `EMBEDDING_VARIANT` from `@/domain/search/embedding-text` and expects `'name-ingredients'`. Verify: `pnpm vitest run src/domain/search/embedding-text.test.ts` fails because the export is missing.
- [x] 2.2 GREEN. Move `export const EMBEDDING_VARIANT = 'name-ingredients';` from `embed-recipes.ts:8` into `src/domain/search/embedding-text.ts`. Point the imports to `@/domain/search/embedding-text` in `embed-recipes.ts`, `embed-recipes.test.ts`, `search-menus.ts` (L8) and `scripts/evaluacion/similarity-floor.ts` (L8). Verify: `pnpm vitest run src/domain/search/embedding-text.test.ts src/application/use-cases/embed-recipes.test.ts src/application/use-cases/search-menus.test.ts` passes, and `Select-String -Path src,scripts -Pattern "use-cases/embed-recipes'" -Recurse` finds only `cli-container.ts` and the use case's own test.
- [x] 2.3 RED. Create `src/application/dto/search-request.test.ts`. Move into it the whole `describe('parseSearchRequest', …)` block from `search-menus.test.ts` (around L30), with the helpers and fixtures it uses, importing `parseSearchRequest` from `@/application/dto/search-request`. Verify: `pnpm vitest run src/application/dto/search-request.test.ts` fails because the export is missing.
- [x] 2.4 GREEN. Move into `src/application/dto/search-request.ts`:
  - from `search-menus.ts`, `parseSearchRequest` (L76) with its private helpers (`toIssue`, `constraintIdAt`, `invalid`, `toSearchRequest`, `toConstraint`), `searchRequestSchema`, and the types they use (`ValidDto`, and the domain imports they need)
  - order: the exported function first, then its helpers in call order

  Then update the imports:
  - `search-menus.ts` imports `parseSearchRequest` from the DTO
  - `decompose-request.ts` L5 and `evaluate-search.ts` L10 import it from `@/application/dto/search-request`; `evaluate-search.ts` keeps `searchMenus` and `SearchMenusDeps` from `search-menus`
  - `search-menus.test.ts` keeps only its `searchMenus` tests and imports `parseSearchRequest` from the DTO if it still uses it

  Verify: `pnpm vitest run src/application/dto/search-request.test.ts src/application/use-cases/search-menus.test.ts src/application/use-cases/decompose-request.test.ts src/application/use-cases/evaluate-search.test.ts` passes.
- [x] 2.5 RED. Move `src/domain/search/ranking-metrics.test.ts` and `src/domain/search/decomposition-score.test.ts` to `src/domain/evaluation/` with `git mv`, and change their imports to `@/domain/evaluation/...`. Verify: `pnpm vitest run src/domain/evaluation` fails because the modules are missing.
- [x] 2.6 GREEN. Move `ranking-metrics.ts` and `decomposition-score.ts` to `src/domain/evaluation/` with `git mv`. Update `evaluate-search.ts` L13 and `evaluate-decomposer.ts` L14. If the moved files import from `@/domain/search/...`, those imports stay. Verify: `pnpm vitest run src/domain/evaluation src/application/use-cases/evaluate-search.test.ts src/application/use-cases/evaluate-decomposer.test.ts` passes.
- [x] 2.7 Run `pnpm eslint` on every file this track touched, and `pnpm vitest run src/domain/search src/domain/evaluation src/application/dto src/application/use-cases/search-menus.test.ts src/application/use-cases/embed-recipes.test.ts src/application/use-cases/decompose-request.test.ts src/application/use-cases/evaluate-search.test.ts src/application/use-cases/evaluate-decomposer.test.ts`. Verify:
  - the tests pass
  - the only ESLint errors left in these files are the two expected ones: `evaluate-search` → `searchMenus` and `evaluate-decomposer` → `decomposeRequest`

## 3. Phase 2, track B — menu (Haiku, parallel with A and C)

**May touch:**
- `src/application/use-cases/` → `active-menu.ts`, `active-menu.test.ts` (both deleted), `week-menu.ts`, `week-menu.test.ts`, `selected-week.ts` (all three deleted), `menu-week-page.ts`, `menu-week-page.test.ts`
- `src/composition/web-container.ts`, `src/composition/web-container.test.ts`

**Must not touch:** `current-selections.ts`, `src/app/`, `eslint.config.mjs`, `vitest.config.mts`, `package.json`, and any file of tracks A or C.

- [x] 3.1 Switch the pool test in `web-container.test.ts` (L76-84) from `container.activeMenu({ userId: 'user-1' })` to `container.currentSelections({ userId: 'user-1' })`, keeping its two expectations (design.md D7). Verify: `pnpm vitest run src/composition/web-container.test.ts` passes. If `currentSelections` takes a different input, use its real signature from `web-container.ts`.
- [x] 3.2 Delete `active-menu.ts` and `active-menu.test.ts` with `git rm`. Remove the `ActiveMenuInput` import (L3), the `activeMenu` import (L11) and the `activeMenu:` entry (L71) from `web-container.ts`. Verify: `Select-String -Path src -Pattern "active-menu|activeMenu\(" -Recurse` finds nothing, and `pnpm vitest run src/composition` passes.
- [x] 3.3 RED. Move every `it(...)` case of `week-menu.test.ts` into `menu-week-page.test.ts`, inside a `describe('the week menu', …)` block, keeping names and assertions. Each case now calls `menuWeekPage` with the `startsOn` of its scenario and reads the week from the page result. Copy the fixtures and helpers they need. Verify: `pnpm vitest run src/application/use-cases/menu-week-page.test.ts` runs the moved cases. Any of them that fails only because of the call shape shows that the call site still has to change.
- [x] 3.4 GREEN. Move `selectedWeek` (from `selected-week.ts`) and `weekMenu` (from `week-menu.ts`) into `menu-week-page.ts`:
  - they become non-exported `function` helpers below `menuWeekPage`, in call order
  - `WeekFailure` stays exported from `menu-week-page.ts`
  - the helpers' input and output types are renamed only if they clash

  Then delete `week-menu.ts`, `week-menu.test.ts` and `selected-week.ts` with `git rm`. Verify: `pnpm vitest run src/application/use-cases/menu-week-page.test.ts` passes, and `Select-String -Path src -Pattern "use-cases/(week-menu|selected-week)" -Recurse` finds nothing.
- [x] 3.5 Coverage of the merged file. Run `pnpm vitest run --coverage --coverage.include=src/application/use-cases/menu-week-page.ts src/application/use-cases/menu-week-page.test.ts`. Verify: 100 % for statements, branches, functions and lines.
  - If a branch of the former `selectedWeek` is uncovered, add a test through `menuWeekPage` that reaches it.
  - If no input to `menuWeekPage` can reach it, do not test it: report it, so Phase 3 can remove it as dead code (design.md D6).
- [x] 3.6 Run `pnpm eslint` on `menu-week-page.ts`, `menu-week-page.test.ts`, `web-container.ts` and `web-container.test.ts`. Verify: no errors.

## 4. Phase 2, track C — selection (Haiku, parallel with A and B)

**May touch:**
- `src/application/dto/` → `positive-integer-input.ts`, `positive-integer-input.test.ts` (both new)
- `src/application/use-cases/` → `select-menu.ts`, `select-menu.test.ts`, `check-shopping-items.ts`

**Must not touch:** `shopping-checklist.ts`, `select-random-menu.ts`, `eslint.config.mjs`, `vitest.config.mts`, `package.json`, and any file of tracks A or B.

- [x] 4.1 RED. Create `src/application/dto/positive-integer-input.test.ts`, importing `positiveIntegerInput` from `@/application/dto/positive-integer-input`. Its cases, using `safeParse`:
  - accepts `3` and `'12'` (giving the number 12)
  - refuses `0`, `-1`, `1.5`, `'12abc'`, `'1.5'`, `''` and a number above `Number.MAX_SAFE_INTEGER`

  Verify: `pnpm vitest run src/application/dto/positive-integer-input.test.ts` fails because the module is missing.
- [x] 4.2 GREEN. Move `positiveSafeInteger` and `positiveIntegerInput`, with the comment above it, from `select-menu.ts` (L17-28) to `src/application/dto/positive-integer-input.ts`, with `import { z } from 'zod'`. Import it from the DTO in `select-menu.ts` and in `check-shopping-items.ts` (L5). Verify: `pnpm vitest run src/application/dto/positive-integer-input.test.ts src/application/use-cases/select-menu.test.ts src/application/use-cases/check-shopping-items.test.ts` passes.
- [x] 4.3 Run `pnpm eslint` on the four files above. Verify: the only error left is `check-shopping-items` → `currentShoppingSelection` (expected, MF-59.2), and there is none for `select-menu`.

## 5. Phase 3 — Integration (sequential, after A, B and C)

- [x] 5.1 Check that each track stayed in its files: `git status --short` and `git diff --stat` touch only the files listed in sections 1–4, plus the scratchpad. Verify: no file outside those lists changed.
- [x] 5.2 Add the temporary exception block from design.md D4 to `eslint.config.mjs`:
  - `files`: `select-random-menu.ts`, `check-shopping-items.ts`, `evaluate-search.ts` and `evaluate-decomposer.ts`
  - allowed targets: `select-menu`, `shopping-checklist`, `search-menus` and `decompose-request`
  - comment: "Temporary: MF-59.2 replaces these with services"
  - Added on 2026-10-12 by the author's decision: a second temporary block lets 6 DTOs import 10 port types until MF-59.4 (design.md D4). Without both blocks the run has 14 errors (4 + 10).

  Verify: `pnpm eslint src scripts` has 0 errors, and removing the block brings back exactly 4.
- [x] 5.3 Update `context/adr/ADR-001-arquitectura-interna.md` §3:
  - add the `application/services` row
  - state that a use case may import services but not another use case, and that a service may import services but not use cases, with no cycles (`import/no-cycle`)
  - in the derived rule, mention that `checkInternals` is what makes the rule verifiable

  Verify: the table in ADR-001 §3 matches the policy in `eslint.config.mjs`.
- [x] 5.4 Full checks. Verify that each passes:
  - `pnpm lint` (ESLint + knip, with no orphan export from the moves)
  - `pnpm typecheck`
  - `pnpm test:run`
  - `pnpm test:coverage`, at 100 % in `src/domain/**` and `src/application/**`, `dto/` included
  - the test count equals the count before Phase 2 minus the deleted `active-menu.test.ts` cases, plus the new `positive-integer-input` and `embedding-text` cases
- [x] 5.5 Remove any branch that track B reported as unreachable (task 3.5), and rerun `pnpm test:coverage`. Verify: still 100 %.
- [x] 5.6 Commit with a conventional message, for example `refactor(application): dependency rule between use cases (MF-59.1)`. Verify: the pre-commit hook passes.

## Safety review (`context/seguridad/safety-first.md` §4)

- No new endpoint, command, query or input: auth, permissions, data minimisation, SQL and logging items do not apply.
- Validation stays on the server: `parseSearchRequest` and `positiveIntegerInput` moved to `application/dto/` with their negative tests.
- No secret in the diff.
- New devDependency `eslint-plugin-import` 2.32.0: exists on npm, maintained, already present through `eslint-config-next`, justified in design.md D3. Not shipped to production.
- No deviation from a MUST rule.
