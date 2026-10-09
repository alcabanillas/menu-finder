## 1. `/menu`: day cards (design D1)

- [x] 1.1 Rename `columns.ts` to `days-shown.ts` and `columnsOf` to `daysShown`, with its test; run the tests green (refactor, no behaviour change)
- [x] 1.2 Test `week-cards.tsx` first, seen failing: "The week as day cards" (seven cards, weekday headings, "5 de octubre"…"11 de octubre", today's card says "Hoy", dishes under "Comida" and "Cena" in order)
- [x] 1.3 Test first, seen failing: "Sunday without dishes is left out" (six cards), "A meal with no dishes" (no "Cena"), "A day with no dishes" (the empty-day sentence, no meal labels)
- [x] 1.4 Test first, seen failing: "Dishes with and without a recipe" (a `button` with `aria-haspopup="dialog"` and "45 min", a plain-text dish with no time); the open dish is announced as expanded
- [x] 1.5 Implement `week-cards.tsx` after the mock's `.mf-wk` (card, head with day bar, date and "Hoy", eyebrows, rows, olive underline on hover, focus and open) until 1.2–1.4 pass
- [x] 1.6 Switch `weekly-menu.tsx` from `WeekTable` to `WeekCards`; delete `week-table.tsx`, its test and `formatColumnDate` with its test; update `weekly-menu.test.tsx` queries from the table to the cards

## 2. `/menu`: the panel's side and the 1440 px box (design D2, D3)

- [x] 2.1 Test first in `weekly-menu.test.tsx`, seen failing: "The panel takes the side away from the dish", stubbing the button's `getBoundingClientRect` and `clientWidth` (a dish in the left half → panel `data-side="right"`, in the right half → `"left"`)
- [x] 2.2 Implement the side in `openDish` from the button's centre against the viewport's, kept with the open dish; drop the column-index rule in `OpenRecipe`
- [x] 2.3 Widen the page box to 1440 px in `weekly-menu.tsx` and the panel's outer edge in `recipe-panel.tsx`; check "Opening a recipe", "Closing with Escape", "Closing with the close button" and "Opening another dish" stay green

## 3. `/shopping-list`: the category index (design D4, D5)

- [x] 3.1 Extract the hidden fields of `CategoryToggle` into `CategoryTickForm`; `category-toggle.test` (or `shopping-checklist.test.tsx`) stays green (refactor)
- [x] 3.2 Test `category-index.tsx` first, seen failing: "The index lists the categories" (a `nav` "Categorías", each row's `role="checkbox"` "Marcar todos: Legumbres" with `aria-checked` mixed, the count "1/2", a link "Legumbres" to `#categoria-1`)
- [x] 3.3 Test first, seen failing: "Ticking a category from the index" (the index form posts every position of the category with `checked=true`; with JavaScript the count shows "2/2" at once and no other category changes)
- [x] 3.4 Test first in `shopping-checklist.test.tsx`, seen failing: "The index follows the view" (in "Por comprar", a fully ticked category is in neither the index nor the list) and each category `section` has the `id` its link points to and its heading shows the count
- [x] 3.5 Implement `category-index.tsx` and the desktop layout of `shopping-checklist.tsx` (grid `260px | 1fr`, sticky index with its own scroll, section ids, header counts, "Marcar todos" row hidden from 800 px, items in 2 columns from 1100 px, hairline under the top, 1440 px box) until 3.2–3.4 pass

## 4. Shell (design D3)

- [x] 4.1 Widen the header box of `app-shell.tsx` to 1440 px; `app-shell` tests stay green

## 5. End-to-end (design D8)

- [x] 5.1 `e2e/menu.spec.ts` desktop: rewrite the table tests for the cards, seen failing against the old table first ("The week as day cards", "Opening a recipe", "Closing with Escape", "The cards without JavaScript")
- [x] 5.2 `e2e/shopping-list.spec.ts` desktop (1280 × 800), seen failing first: "The index lists the categories", "Ticking a category from the index", "A link goes to its category", "One tick-every-item control per category", "Ticking from the index without JavaScript"
- [x] 5.3 `e2e/shopping-list.spec.ts` narrow: "No index on a narrow screen"
- [x] 5.4 Check the existing negative scenarios of the tick action (no session, invalid positions, changed list) still pass unchanged: the index posts through the same action

## 6. Close

- [x] 6.1 `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm e2e` green
- [x] 6.2 Compare screenshots of `/menu` and `/shopping-list` at 1280 and 1900 px with the mock (UI-design-system step 4)
- [ ] 6.3 Update MF-56 in `context/roadmap.md` (scope: `/menu` and `/shopping-list`, estimate ~4.5 h) and go through `context/safety-first.md` §4 before the archive
