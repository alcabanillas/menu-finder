## 1. The use case (TDD)

- [ ] 1.1 RED: `select-random-menu.test.ts` with in-memory repositories, a fixed clock and a fixed random: "Choosing a random menu"; "Every menu can be picked" (random 0 and 0.999…); "No menus stored"; a read failure of the menus and of the selections, and `unknown-menu`, give `failed`; see them fail
- [ ] 1.2 GREEN: `select-random-menu.ts` (design D2); `selectRandomMenu` in `web-container.ts` with `PostgresMenuRepository` and `Math.random`, and its test

## 2. The feature (TDD)

- [ ] 2.1 Move `Button` and its test to `src/shared/ui/`; the auth tests still pass
- [ ] 2.2 RED: `format-monday.test.ts`: 2026-10-05 gives "lunes 5 de octubre", 2026-12-28 gives "lunes 28 de diciembre"; see them fail
- [ ] 2.3 GREEN: `format-monday.ts` (design D5)
- [ ] 2.4 RED: `selection-summary.test.tsx` ("Nothing chosen", "This week and next week chosen", "The selections cannot be read") and `random-menu-form.test.tsx` (a submit button "Elegir un menú al azar"; a success in a status region, a failure in an alert); see them fail
- [ ] 2.5 GREEN: the components and `selection-summary.ts` (design D3)

## 3. The page and its action (TDD)

- [ ] 3.1 RED: `actions.test.ts` with the session and the web container mocked: "Choosing a random menu" (message and `revalidatePath`); "No menus stored"; "The database fails"; "Choosing without a session" (redirect, `selectRandomMenu` never called); "Fields in the request are ignored" (`selectRandomMenu` gets only the session's user); extend `protected-pages.test.ts` to `(app)/**/actions.ts`; see them fail
- [ ] 3.2 GREEN: `actions.ts` (design D4)
- [ ] 3.3 RED: `planner/page.test.tsx`: keeps "Hola, {name}" and no main landmark; shows the summary and the form; when `currentSelections` fails it says the menu could not be loaded; see them fail
- [ ] 3.4 GREEN: `page.tsx`

## 4. End-to-end (design D6)

- [ ] 4.1 `e2e/planner.spec.ts`: "Choosing a random menu", "Choosing without JavaScript", "Choosing without a session"
- [ ] 4.2 `pnpm test:e2e` passes

## 5. Check and close

- [ ] 5.1 Run the app against the `dev` branch and capture `/planner` at 375 px and 1160 px after choosing
- [ ] 5.2 `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` and `pnpm build` pass
- [ ] 5.3 Before `archive`: the checklist of `context/safety-first.md` §4, with the result recorded here; mark MF-43.2 and MF-43 done in `context/roadmap.md`
