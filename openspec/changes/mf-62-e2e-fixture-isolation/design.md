## Context

See proposal.md - Why. The end-to-end specs write to the `public` schema of the test branch with `pg`, in `beforeAll`/`afterAll` hooks. Accounts are already per run (`registerTestAccount`, MF-49 design D4: random email per module load, so per worker). Menus, recipes and shopping items are not. Playwright loads a spec module once per worker, so a value computed at module level is shared by the repeats one worker runs one after another, and differs between workers.

## Goals / Non-Goals

**Goals:**
- Two runs of the same spec file at the same time never touch the same menu, recipe or shopping item rows.
- The tests check exactly what they check today.

**Non-Goals:**
- Cleaning rows left by runs that were cut short (a killed worker skips `afterAll`). Fixed numbers left the same rows behind before this change; with random numbers they no longer get in the way of later runs. A stale cleanup like the one for test schemas is possible later if they pile up.
- A schema per end-to-end run, as the integration tests have: the Next.js server reads `public`, and a schema per run would need a server per run.
- The Windows worker crash `0xC0000409` (proposal - What Changes).

## Decisions

**D1. One random base per run, from which numbers and keys are derived.** `e2e/support/fixture-run.ts` exports `newFixtureRun(random = Math.random)`, which picks a base integer in `[1_000_000, 2_000_000_000]` and returns `menuNumber(offset)` (`base + offset`) and `key(name)` (`` `${name}-${base}` ``). A spec file calls it once at module level, next to `registerTestAccount()`. One source of randomness keeps menu numbers and recipe keys of a run together and lets the unit test inject `random`.
- *Alternative: a sequence or a table that hands out numbers.* Rejected: needs coordination through the database for a problem a random draw over two billion values solves. Two runs collide only if their bases are within the few offsets a file uses (at most 3): under 1 in 10⁸.
- *Alternative: `--workers=1` or a lock.* Rejected: it hides the bug for `--repeat-each` and does nothing for two checkouts running at once.

**D2. The range.** Above 1 000 000 so no real menu (1 to 36) and none of the old fixed fixtures (9001 to 9102) can match; below 2 000 000 000 so `base + offset` fits a PostgreSQL `integer` (max 2 147 483 647) and `CHECK (number > 0)` holds.

**D3. Recipe keys carry the run, titles and dish names do not.** `menu_dish.recipe_key` references `recipe.key` without cascade, so a shared key lets one run's `afterAll` fail or delete another run's recipe. The key is internal; the titles and dish names the tests read on the page stay as they are.

**D4. Hooks delete by their own identifiers only.** The `DELETE … WHERE menu_number = ANY(…)` and `DELETE FROM recipe WHERE key = ANY(…)` already filter by the constants; with D1 those constants are the run's. `shopping-list.spec.ts` keeps its `DELETE FROM shopping_item` before seeding, which is now a no-op on a fresh number but harmless.

## Risks / Trade-offs

- [A run cut short leaves rows with a random number] → they are fictitious, under numbers no later run picks in practice; noted as a non-goal above.
- [Menu numbers with 7 to 10 digits on screen] → the specs read the number from the same constant (`Menú ${MENU}`), so no assertion depends on its length. The 375 px view of `menu.spec.ts` shows the heading `Menú <number>`; a longer number may wrap, which no test asserts.
