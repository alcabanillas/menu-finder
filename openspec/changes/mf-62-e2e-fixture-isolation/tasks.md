## 1. Fixture identifiers per run (TDD)

- [x] 1.1 Write `e2e/support/fixture-run.test.ts` for "Two runs get different fixtures" (two runs with different `random` give disjoint menu numbers and keys) and "Fixture menus are not real menus" (with `random` at 0 and just below 1, every number is above 36, at least 1 000 000 and at most 2 147 483 647); run `pnpm test:run e2e/support/fixture-run.test.ts` and see it fail
- [x] 1.2 Implement `e2e/support/fixture-run.ts` (design D1, D2) and see 1.1 pass

## 2. Spec files on their own fixtures

- [x] 2.1 `e2e/shopping-list.spec.ts`: `MENU` and `OTHER_MENU` from `newFixtureRun()`; check with `pnpm test:e2e e2e/shopping-list.spec.ts --repeat-each=3` that every test passes (scenario "The same spec file run three times in parallel"; it failed before, 2026-10-12)
- [x] 2.2 `e2e/planner.spec.ts`: `MENU` from the run; check with `pnpm test:e2e e2e/planner.spec.ts --repeat-each=3`
- [x] 2.3 `e2e/menu.spec.ts`: `MENU`, `RECIPE` and `PLAIN` key from the run, titles unchanged (design D3); check with `pnpm test:e2e e2e/menu.spec.ts --repeat-each=3`
- [x] 2.4 `e2e/menu-weeks.spec.ts`: the three week numbers and the dish keys from the run (design D3); check with `pnpm test:e2e e2e/menu-weeks.spec.ts --repeat-each=3`

## 3. Whole run and checks

- [x] 3.1 Run `pnpm test:e2e e2e/shopping-list.spec.ts --repeat-each=3` three times in a row and record the results in the PR
- [x] 3.2 Run `pnpm test:e2e` once in full, `pnpm lint`, `pnpm test:coverage`, and see them pass
- [x] 3.3 Add MF-62 to `context/roadmap.md` with its result and a link to this change

## Results (2026-10-12, Windows)

- Before (cfcf4f5): `pnpm test:e2e e2e/shopping-list.spec.ts --repeat-each=3`: 3 failed, 36 did not run; two failures were `duplicate key value violates unique constraint "shopping_item_pkey"`.
- After, three runs in a row of the same command: 39 passed, 39 passed, 39 passed. One earlier attempt ended before any test ran, with the Playwright process itself exiting `3221226505` (`0xC0000409`); that native crash is out of scope (proposal - What Changes).
- The four changed spec files together with `--repeat-each=3`: 111 passed. Full `pnpm test:e2e`: 88 passed. `pnpm lint` and `pnpm test:coverage` (1353 tests): pass.
