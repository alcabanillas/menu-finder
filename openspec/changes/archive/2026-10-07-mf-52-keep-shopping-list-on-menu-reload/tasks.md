## 1. Reproduce the bug (red)

- [x] 1.1 In `src/infrastructure/postgres/postgres-menu-repository.test.ts`, add the test for the scenario "Shopping list kept when its menu is replaced": save menu 4 with fictitious dishes, save a fictitious shopping list for menu 4 with `PostgresShoppingListRepository.saveAll`, save menu 4 again with `PostgresMenuRepository.saveAll`, and assert the shopping items of menu 4 are the same rows. Run `pnpm test:run src/infrastructure/postgres/postgres-menu-repository.test.ts` against `DATABASE_URL_TEST` and see it fail with no shopping items
- [x] 1.2 Add the test for the scenario "Replaced menu loses its old dishes": menu 4 with two lunch dishes, saved again with one different dish, leaves only the new dish. Run it and record whether it already passes (today's delete-and-insert covers it); it guards the refactor in 2.1. Result: it passed before the fix, as expected

## 2. Fix (green)

- [x] 2.1 In `PostgresMenuRepository.write`, insert the menus with `ON CONFLICT (number) DO NOTHING` and replace `DELETE FROM menu` with `DELETE FROM meal WHERE menu_number = ANY($1::int[])` (design D1); update the cascade comment. Verify the tests from 1.1 and 1.2 pass, and the existing scenarios "Menu not received is kept" and "Recipe missing from the database" still pass

## 3. Close

- [x] 3.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:run`, all green
- [x] 3.2 Mark MF-52 as done in `context/roadmap.md` with the link to the archived change, and go through `context/safety-first.md` §4 before archiving. Result: no new endpoint, input, sensitive action or dependency, so the items on endpoints, authorization, input tests, logs and packages do not apply. The queries stay parameterized (`ANY($1::int[])` and `jsonb_to_recordset`, no string concatenation); no data is returned; the test fixtures are fictitious; no secret in the diff; no deviation from a rule of the document
