## 1. Shared pieces (TDD, design D2 and D4)

- [x] 1.1 RED: `format-date.test.ts`: 2026-10-07 gives "Miércoles" (`formatWeekday`) and "7 oct" (`formatColumnDate`); see them fail
- [x] 1.2 GREEN: `formatWeekday` and `formatColumnDate` in `format-date.ts`
- [x] 1.3 RED: `columns.test.ts`: `columnsOf` gives Monday to Sunday when Sunday has a dish, and Monday to Saturday when it has none; see them fail
- [x] 1.4 GREEN: `src/features/weekly-menu/columns.ts`
- [x] 1.5 REFACTOR: move `RecipeBody` out of `recipe-card.tsx` into `components/recipe-body.tsx`, without the card's border and padding; `recipe-card.test.tsx` still passes unchanged

## 2. The week table (TDD, design D2)

- [x] 2.1 RED: `week-table.test.tsx`: "The week as a table" (a table "Menú de la semana", column headers with weekday and short date, rows "Comida" and "Cena" with the dishes in order, today's header with "hoy"); "Sunday without dishes is left out"; "A meal with no dishes" (a dash); "Dishes with and without a recipe" (a button with `aria-haspopup="dialog"` and plain text); activating a dish calls `onOpen` with it; the open dish is announced as expanded; see them fail
- [x] 2.2 GREEN: `components/week-table.tsx`

## 3. The recipe panel (TDD, design D3 and D4)

- [x] 3.1 RED: `recipe-panel.test.tsx`: a dialog named after the dish, with "Miércoles · Comida", the times, the ingredients with "240 g" and the numbered steps; the close button "Cerrar receta" has the focus on open; Escape and the close button call `onClose`; the side class follows the `side` prop; see them fail
- [x] 3.2 GREEN: `components/recipe-panel.tsx` and the `x` glyph in `menu-icon.tsx`

## 4. Both views in the page (TDD, design D1 and D3)

- [x] 4.1 RED: `weekly-menu.test.tsx`: the page has both the day tab panel and the table, each with its responsive class; "Opening a recipe" (the dialog opens, focus inside, the dish expanded); "Closing with Escape" and "Closing with the close button" (focus back on the dish, now collapsed); "Opening another dish" (the panel shows it, only it expanded); "The panel takes the side away from the dish" (Monday right, Saturday left); the MF-23.1 tests, scoped to the tab panel, still pass; see the new ones fail
- [x] 4.2 GREEN: `weekly-menu.tsx`: the mobile view and the table by container width, the page wrapper widened at 800 px, the open dish and its trigger in state

## 5. End-to-end (design D6)

- [x] 5.1 `e2e/menu.spec.ts`, a `describe` at 1280 × 800: the table with seven columns and today marked "hoy", no day tabs; opening the fictitious recipe (dialog named after it, focus inside); Escape closes it and the focus is back on the dish; without JavaScript the table shows the week. The 375 px tests still pass
- [x] 5.2 `pnpm test:e2e` passes and leaves no rows behind

## 6. Check and close

- [x] 6.1 Capture `/menu` at 1280 px with a recipe open, on the production build against the `test` branch with the fictitious menu, and compare it with `MenuScreen.jsx` (desktop) in the design system; note any difference beyond design D4. Day headers (colour bar, weekday, short date, "· hoy"), today's column, the dashes, the underlined open dish and the panel's frame match the mock. The chef-hat icon fell alone on the next line under a two-word name; as in the mock, the last word and the icon now stay together
- [x] 6.2 `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` and `pnpm build` pass
- [x] 6.3 Before `archive`: the checklist of `context/safety-first.md` §4, with the result recorded here; mark MF-23.2 and MF-23 done in `context/roadmap.md`
  - Business rules in the backend: unchanged; which menu, its dates and "today" still come from `activeMenu`. The table only lays out the DTO; leaving Sunday out is presentation
  - Session and input: the page is unchanged, `await requireUser()` first and no `searchParams`; its tests and `protected-pages.test.ts` pass
  - User from the session: unchanged; "Another user's menu is not shown" and "Opening the menu without a session" still pass in `e2e/menu.spec.ts`
  - Minimum data: no new read; the page receives the same DTO as in MF-23.1
  - No secrets in the diff; no new dependencies (the `x` icon is inline SVG)
  - Queries: none added
  - Unexpected values: no new input; recipe text is rendered by React, which escapes it
  - Logs: nothing logged, nothing new to log
  - Deviations from a MUST rule: none. From the mock: the panel shows the recipe as the card does (design D4)
