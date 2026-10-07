## 1. Reading through the existing ports (TDD, design D1)

- [x] 1.1 RED: in `postgres-menu-repository.test.ts`, `find` returns one stored menu with its fourteen meals and dishes in order, and `null` for a number not stored; see them fail
- [x] 1.2 GREEN: `MenuRepository.find` in the port, `PostgresMenuRepository` and `JsonFileMenuRepository` (with its test: found and not found); the tests pass
- [x] 1.3 RED: in `postgres-recipe-repository.test.ts`, `findByFiles` returns only the recipes asked for, with times, ingredients in position order (quantity as a number, household measure, unit, optional) and preparation steps; an empty list returns none; a file not stored is left out; see them fail
- [x] 1.4 GREEN: `RecipeRepository.findByFiles` in the port, `PostgresRecipeRepository` and `JsonFileRecipeRepository` (with its test); the tests pass

## 2. The week in the domain (TDD, design D2)

- [x] 2.1 RED: `week.test.ts`: `weekDates('2026-10-05')` gives 2026-10-05 to 2026-10-11, and across the end of October 2026 (daylight-saving change) and of a year the dates stay consecutive; see them fail
- [x] 2.2 GREEN: `weekDates` in `src/domain/selection/week.ts`
- [x] 2.3 RED: `menu-week.test.ts`: seven days in order with their dates; lunch and dinner dishes in the menu's order; a dish keeps its recipe when its file was read, and has `null` without a recipe file or when its file was not read; a day with no dishes has empty meals; see them fail
- [x] 2.4 GREEN: `src/domain/menu/menu-week.ts`

## 3. The use case (TDD, design D2 and D3)

- [x] 3.1 RED: `active-menu.test.ts` with in-memory repositories and a fixed clock: "The week of the active menu" (menu 3 from 2026-10-05, today 2026-10-07); "Next week's menu is not the active one" gives `null`; no selection gives `null`; it asks for the recipes of the menu's distinct recipe files only; a failure reading the selections, the menu or the recipes, and a selected menu that `find` does not return, give `failed`; see them fail
- [x] 3.2 GREEN: `active-menu.ts` and `src/application/dto/weekly-menu.ts`; `activeMenu` in `web-container.ts` with `PostgresRecipeRepository`, and its test in `web-container.test.ts`

## 4. The feature `weekly-menu` (TDD, design D5 and D6)

- [x] 4.1 RED: `format-date.test.ts`: 2026-10-05 gives "5 de octubre" and 2026-10-07 gives "Miércoles 7 de octubre"; see them fail
- [x] 4.2 GREEN: `format-date.ts`
- [x] 4.3 RED: `recipe-card.test.tsx`: "Unfolding a recipe", "Folding a recipe", "Amounts, optional ingredients and unknown times", "A dish without a recipe" (no button, "Sin receta"); see them fail
- [x] 4.4 GREEN: `recipe-card.tsx` and `menu-icon.tsx`
- [x] 4.5 RED: `day-tabs.test.tsx`: seven tabs with weekday and day of month; one selected; today's tab marked with an accessible "hoy"; right and left arrows, Home and End move the focus and the selection; see them fail
- [x] 4.6 GREEN: `day-tabs.tsx`
- [x] 4.7 RED: `weekly-menu.test.tsx`: "The week of the active menu" (heading, "Semana del 5 de octubre", today selected); "Today's dishes" under "Comida" and "Cena"; "Selecting another day"; "A day with no dishes"; the tab panel is labelled by its tab; and `empty-menu.test.tsx`: no menu (message and link to `/planner`) and the failure message; see them fail
- [x] 4.8 GREEN: `weekly-menu.tsx` and `empty-menu.tsx`

## 5. The page (TDD, design D4)

- [x] 5.1 RED: `menu/page.test.tsx` with the session and the web container mocked: shows the active menu; "No menu chosen for this week"; "The menu cannot be read" with no detail of the error; `activeMenu` gets only the session's user; "Parameters in the request are ignored"; "Opening the menu without a session" redirects and never calls `activeMenu`; `protected-pages.test.ts` still passes; see them fail
- [x] 5.2 GREEN: `src/app/(app)/menu/page.tsx`; update the `app-shell` page test for `/menu` (heading starting with "Menú")

## 6. End-to-end (design D7)

- [x] 6.1 `e2e/menu.spec.ts` with fictitious menu 9002 and its recipe: "The week of the active menu" (today's tab selected), "Selecting another day", "Unfolding a recipe", "A dish without a recipe", "Without JavaScript", "Opening the menu without a session", and "Another user's menu is not shown" (a second account with no selection); it removes everything it inserted
- [x] 6.2 Update `e2e/app-shell.spec.ts` if it expects the `/menu` placeholder; `pnpm test:e2e` passes

## 7. Check and close

- [x] 7.1 Capture `/menu` at 375 px with a recipe unfolded and compare it with `MenuScreen.jsx` (mobile) in the design system; note any difference beyond design D6. Done on the production build against the `test` branch with fictitious accounts and menu 9002, as in MF-43.2 (signing in on `dev` needs a real password). Heading, day tabs (colour bars, the ink tile, today's dot), meal headers and the folded and unfolded card match the mock. As in the mock, a meal with no dishes on a day that has others shows its header with nothing under it
- [x] 7.2 `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` and `pnpm build` pass
- [x] 7.3 Before `archive`: the checklist of `context/safety-first.md` §4, with the result recorded here; mark MF-23.1 done in `context/roadmap.md`
  - Business rules in the backend: yes, which menu is active, its dates and "today" are computed on the server (`activeMenu`, `Clock`)
  - The new page checks the session first (`await requireUser()`, checked by `protected-pages.test.ts`) and takes no input: it declares no `searchParams`
  - User from the session: yes; "Parameters in the request are ignored" is tested in `page.test.tsx`, and "Another user's menu is not shown" in `active-menu.test.ts` and `e2e/menu.spec.ts`
  - Negative authorization tests in CI: "Opening the menu without a session" in `page.test.tsx` and in `e2e/menu.spec.ts`
  - Minimum data: the page gets only the active menu and the recipes of its dishes, without recipe file names or source menus (`menuWeek`)
  - No secrets in the diff; no new dependencies (the icons are inline SVG)
  - Parameterised queries: `find` and `findByFiles` pass the number and the files as `$n`; the e2e queries too
  - Unexpected values: the page takes no input. Names with SQL metacharacters and odd Unicode are already covered by the menu repository's tests, and React escapes what it renders
  - Logs: reading one's own menu is not a sensitive action; nothing logged. A database error reaches the page only as "failed", with no detail
  - Deviations from a MUST rule: none. From the mock: a dish without a recipe is not a button (design D6)
