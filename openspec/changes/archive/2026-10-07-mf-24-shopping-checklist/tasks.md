Order: group 1 (the contract) first and alone. Groups 2, 3 and 4 are the parallel tracks A, B and C of design D3: they own disjoint files and can run at the same time. Group 5 starts when 2, 3 and 4 are green.

## 1. Contract (sequential, before the tracks)

- [x] 1.1 Compare `project/tokens.json` of the design system (version `1791390572-4ab7`) with `design-system/tokens.json`; if they differ, copy it, write the version to `design-system/VERSION` and run `pnpm ds:tokens`; verify `scripts/design-system/theme.test.ts` passes. Done: identical to the local copy, nothing refreshed
- [x] 1.2 Move `format-monday.ts` and its test from `src/features/menu-planner/` to `src/shared/` and update its imports (design D6); verify the moved test and the planner tests pass
- [x] 1.3 Write the types of design D2: `StoredShoppingItem`, `ChecklistItem`, `ChecklistCategory`, `Checklist`; the new methods of `ShoppingListRepository` and `SelectionRepository`; `src/application/dto/shopping-checklist.ts`; the inputs and failures of both use cases; `CheckItemsState` in `src/features/shopping-list/`
- [x] 1.4 Write the skeletons of design D2 (`toChecklist`, both use cases, the three adapter methods, the empty `checkItemsAction`) and wire `shoppingChecklist` and `checkShoppingItems` in `web-container.ts` with `PostgresShoppingListRepository`; verify `pnpm typecheck`, `pnpm lint` and `pnpm test:run` pass, and that the in-memory test doubles of `SelectionRepository` in existing tests compile. Done: typecheck and 913 tests pass; ESLint has 0 errors (warnings for the skeletons' unused parameters); knip reports the skeleton files and DTO types no page imports yet, which group 5 closes
- [x] 1.5 Review the contract with the author before starting the tracks. Approved on 2026-10-07

## 2. Track A: core (TDD, in-memory repositories)

- [x] 2.1 RED: `checklist.test.ts` for `toChecklist`: categories in order of their first item, items by position, ticked positions marked, counts per category and in total, ticked positions outside the list ignored, empty list gives total 0; see them fail
- [x] 2.2 GREEN: `toChecklist` (design D4); verify 2.1 passes
- [x] 2.3 RED: `shopping-checklist.test.ts`: "A current list with items" (DTO with menu, Monday and categories), "Next week's list is the current one", "No current shopping list" (`ok(null)`), "The menu has no stored list" (total 0), "The list cannot be read" (each of the three reads failing gives `failed`), "Another user's ticks are invisible" (ticks asked with the session's user only), "The same menu another week" (ticks asked by the current selection's id); see them fail
- [x] 2.4 GREEN: `shoppingChecklist` (design D4); verify 2.3 passes
- [x] 2.5 RED: `check-shopping-items.test.ts`: "Ticking an item", "Unticking an item", "Ticking twice is the same as ticking once" (repeated positions are sent once), "Ticking a category" (several positions), "A position that is not a positive integer" (`"2abc"`, `0`, `-1`, `1.5`, none), "A position outside the list", more than 200 positions, "A tick value that is not a boolean" (`"yes"`, none), "The list changed while the page was open", "No current list", "Fields naming another user are ignored" (only the session's user and its current selection reach `setChecked`), a read or write failure gives `failed`; in every refused case `setChecked` is never called; see them fail
- [x] 2.6 GREEN: `checkShoppingItems` (design D4); verify 2.5 passes

## 3. Track B: infrastructure (TDD, test database)

- [x] 3.1 RED: integration tests in `postgres-shopping-list-repository.test.ts` for `find`: items in position order with quantity as a number and null quantity and unit kept; a menu without list gives an empty array; see them fail
- [x] 3.2 GREEN: `find` (design D5); verify 3.1 passes
- [x] 3.3 RED: integration tests in `postgres-selection-repository.test.ts`: `setChecked` true then `checkedPositions` returns them; false unticks; the same position twice keeps one row; "Another user's ticks are invisible" (`checkedPositions` and `setChecked` with another user's selection id read nothing and write nothing); "Replacing next week's menu drops its ticks" (`replace` and the old id has no rows); "Re-loading the shopping lists" (`ShoppingListRepository.saveAll` of the same list keeps the ticks); a position of 0 is refused by the database; see them fail
- [x] 3.4 GREEN: `postgres/migrations/006-user-shopping-item.sql` and `checkedPositions`, `setChecked` (design D5); verify 3.3 passes (26 of 26 against per-file test schemas; `setChecked` groups repeated positions so ON CONFLICT does not hit a row twice; the existing missing-table test now drops `selection` with CASCADE). `pnpm ingest migrate` on the test branch moves to 5.2

## 4. Track C: screen (TDD, DTO fixtures and the container mocked)

- [x] 4.1 Port `SectionHeader`, `ProgressBar` and `Checkbox` from the design system to `src/features/shopping-list/components/`, each noting version `1791390572-4ab7`; with `progress-bar.test.tsx` ("N de M", bar width clamped to 0–100 %) seen failing before the component is written
- [x] 4.2 RED: `format-amount.test.ts`: `400 g`, `1000 ml`, `2`, `0,5 g`, nothing for null; see them fail
- [x] 4.3 GREEN: `format-amount.ts` (design D6); verify 4.2 passes
- [x] 4.4 RED: `shopping-checklist.test.tsx` and `checklist-row.test.tsx` on a DTO fixture: "A current list with items" (menu, Monday, categories in order, "opcional", amounts), "An item without quantity", rows as forms with `menuNumber`, `position` and the new `checked`, `aria-checked` true/false, "Ticking a category" control with `true`/`false`/`mixed` and "done/total", "Only what is left to buy" (hides ticked items and complete categories, progress unchanged), a failure message in `role="alert"` announced again on a repeated failure; see them fail
- [x] 4.5 GREEN: `ShoppingChecklist`, `ChecklistRow`, `CategoryToggle`, `ViewFilter` with `useOptimistic` (design D6); verify 4.4 passes
- [x] 4.6 RED: `actions.test.ts` with the session and the container mocked: "Ticking an item" (`revalidatePath`, no message), "Ticking without a session" (redirect, `checkShoppingItems` never called), "Fields naming another user are ignored" (only `userId` from the session and the three form fields are passed), the messages for `invalid`, `stale` and `failed`; see them fail
- [x] 4.7 GREEN: `checkItemsAction` (design D6); verify 4.6 and `protected-pages.test.ts` pass
- [x] 4.8 RED: `shopping-list/page.test.tsx`: the checklist for a DTO; "No current shopping list" (message and link to `/planner`); "The menu has no stored list"; "The list cannot be read"; "An unknown view" shows everything; `?vista=por-comprar` passes the view; see them fail
- [x] 4.9 GREEN: `page.tsx`; verify 4.8 passes

## 5. Integration (after tracks A, B and C)

- [x] 5.1 No skeleton left: search for the phase 1 placeholders; share the menu-number Zod schema of `select-menu.ts` and `check-shopping-items.ts` instead of duplicating it and verify `pnpm typecheck`, `pnpm lint`, `pnpm test:run` and `pnpm test:coverage` pass with all tracks merged
- [x] 5.2 Apply 006 with `pnpm ingest migrate` on the test branch, then `e2e/shopping-list.spec.ts` (design D7): "Ticking an item" and reload, "Unticking an item", "Ticking without JavaScript", "Ticking a category", "Only what is left to buy", "The list changed while the page was open", "Without a session" for the page and "Ticking without a session" for the action; verify `pnpm test:e2e` passes and leaves no rows of menu 9101. Done: Playwright global setup applies 006; 8 of 8 here and 51 of 51 in the whole e2e run; no rows of menus 9101 or 9102, no ticks and no e2e accounts left
- [x] 5.3 Capture `/shopping-list` at 375 px and 1160 px against the test branch with a fictitious account and compare with `ShoppingScreen.jsx`; record the differences and fix those that clash. Done on the production build against the `test` branch with a fictitious account, menu and list, all deleted afterwards. It matches the mock at both widths. One difference, kept: the mock moves to three columns when its container reaches 1100 px, but the list is capped at 1024 px, so at 1160 px it shows two
- [x] 5.4 `pnpm build` passes
- [x] 5.5 Before `archive`: the checklist of `context/safety-first.md` §4, with the result recorded here; mark MF-24 done in `context/roadmap.md`
  - Business rules in the backend: yes, the current list, the stale check and the positions are decided by the use cases; the client only shows ticks optimistically
  - The new endpoint (`checkItemsAction`) checks the session first and validates every field with Zod; `protected-pages.test.ts` covers it
  - User from the session: yes; the selection is the session user's current list, and "Fields naming another user are ignored" is tested in the use case and the action
  - Negative authorization tests in CI: "Ticking without a session" in `actions.test.ts` and `e2e/shopping-list.spec.ts`; "Another user's ticks are invisible" in the use case and the adapter
  - Minimum data: the page gets the list of the current selection and its ticks, nothing of other selections
  - No secrets in the diff; no new dependencies
  - Parameterised queries: yes, `` everywhere; the e2e test interpolates only a constant date expression
  - Unexpected values: empty, too many (201 positions, `MAX_SAFE_INTEGER + 1`), metacharacters (`2abc`, `1.5`) and a non-ASCII digit (`٣`) are refused
  - Logs: ticking an item is not a sensitive action; nothing logged
  - Deviations from a MUST rule: none
