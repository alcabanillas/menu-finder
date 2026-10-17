## Why

Roadmap item **MF-62**. `pnpm test:e2e e2e/shopping-list.spec.ts` fails locally on a clean `main` (cfcf4f5), and the failing test changes from run to run (observed by the author on 2026-10-12, Windows).

The cause is shared fixture rows, not timing. Every end-to-end spec file seeds its menus with fixed numbers (`shopping-list.spec.ts` 9101 and 9102, `planner.spec.ts` 9001, `menu.spec.ts` 9002, `menu-weeks.spec.ts` 9011 to 9013) and its recipes with fixed keys, in the `public` schema of the one test branch. Two runs of the same file at the same time share those rows: two checkouts of the repository running the end-to-end tests, or `--repeat-each`, which hands each repeat to a different worker. Then:

- both `beforeAll` hooks delete and re-insert the same `shopping_item` rows: `duplicate key value violates unique constraint "shopping_item_pkey"`;
- one run's `afterAll` deletes `selection WHERE menu_number = 9101`, which takes the other run's selection and, by cascade, its ticks: "Menú 9101" is not on the page, a tick does not survive a reload, "Marcar todos: Legumbres" stays unchecked.

Reproduced on 2026-10-12 with `pnpm test:e2e e2e/shopping-list.spec.ts --repeat-each=3`: 3 failed, two of them with the duplicate key.

**Result:** `pnpm test:e2e e2e/shopping-list.spec.ts --repeat-each=3` passes, as do the other spec files with `--repeat-each=3`.

## What Changes

- Each run of an end-to-end spec file seeds its menus with numbers of its own, picked at random far above the real menus (1 to 36), and its recipes with keys that carry the same run identifier. What a run deletes in its hooks is only what it created.
- `shopping-list.spec.ts`, `planner.spec.ts`, `menu.spec.ts` and `menu-weeks.spec.ts` take their numbers and keys from that run identifier instead of constants. What the tests check does not change: they read the number from the same constant they display.
- The worker crash seen once (`code=3221226505`, `0xC0000409`, a native crash of the worker process on Windows) is not covered: it is not shared state. If it happens again in the runs of this change, it is recorded in the PR.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `test-isolation`: adds that the rows an end-to-end run seeds belong to that run, so two runs at the same time on the test database do not see, change or delete each other's rows.

## Impact

- **Code:** new `e2e/support/fixture-run.ts` with its Vitest test; the four spec files above. No change in `src/`, no port (test tooling, ADR-001).
- **Systems:** Neon branch `test` (locally) and `ci` (CI), schema `public`, only rows the tests create.
- **Decisions relied on:** OPS-calidad, OPS-ramas-bd, MF-49 (archived change `2026-10-06-mf-49-test-isolation`, spec `test-isolation`). Contradicts none.
- **Data:** only fictitious menus, recipes and shopping items (AGENTS.md: never real data). No nutritionist data, no real user data.
- **Abuses and OWASP:** the hooks delete rows. A cleanup by a number another run or the real catalogue uses would delete data that is not the test's: A04 Insecure Design. Mitigation: numbers start at 1 000 000, far from the real menus, and every delete is by the run's own numbers and keys. `DATABASE_URL_TEST` keeps pointing only to the test branch (spec `test-isolation`).
