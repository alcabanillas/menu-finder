## 0. Before apply

- [ ] 0.1 The author accepts design D1 (no mock) or makes the mock; MF-43.1 is merged and archived

## 1. Listing the menus (TDD)

- [ ] 1.1 RED: `list-menus.test.ts` against an in-memory `MenuRepository`: menus come in number order with the dish names grouped by day, lunch and dinner (design D2); a read failure gives `failed`; see them fail
- [ ] 1.2 GREEN: `list-menus.ts`, `menu-summary.ts` and `selection-summary.ts`; `listMenus` in `web-container.ts` with its test

## 2. The feature (TDD)

- [ ] 2.1 Move `Button` and its test to `src/shared/ui/`; the auth tests still pass
- [ ] 2.2 RED: `format-monday.test.ts`: 2026-10-05 gives "lunes 5 de octubre", 2026-12-28 gives "lunes 28 de diciembre"; see them fail
- [ ] 2.3 GREEN: `format-monday.ts` (design D5)
- [ ] 2.4 RED: `menu-planner.test.tsx` and `selection-summary.test.tsx`: "Menus in number order", "A menu's dishes, folded" (dishes inside a closed `<details>`), "No menus stored", "Nothing chosen", "This week and next week chosen" (the summary and the "Elegido" badge); each "Elegir" is a submit button with `name="menuNumber"` and the menu's number as value; the message is announced in a status region, and a failure in an alert, again when repeated; see them fail
- [ ] 2.5 GREEN: `src/features/menu-planner/components/` (design D3). Coverage of the feature is 80 % or more

## 3. The page and its action (TDD)

- [ ] 3.1 RED: `actions.test.ts` with the session and the web container mocked: "Choosing a menu" (the message with the Spanish date, `revalidatePath('/planner')`); "Choosing without a session" (redirect to `/login` and `selectMenu` never called); "A user id in the request is ignored" (`selectMenu` gets the session's user); "A tampered menu number" (`invalid-menu` and `unknown-menu` give the same message, without the posted value); "The database fails"; extend `protected-pages.test.ts` to `(app)/**/actions.ts` (design D4); see them fail
- [ ] 3.2 GREEN: `actions.ts`
- [ ] 3.3 RED: `planner/page.test.tsx`: the page passes the menus, the selections and the action to the feature, keeps "Hola, {name}" and still has no main landmark of its own; when `listMenus` fails the page says the menus could not be loaded; see them fail
- [ ] 3.4 GREEN: `page.tsx`

## 4. End-to-end (design D6)

- [ ] 4.1 RED: `e2e/planner.spec.ts`: setup and teardown of the fictitious menus 9001 and 9002 and of the account's selections; "Choosing a menu"; "Choosing without JavaScript"; "Choosing without a session" (a POST without a cookie stores nothing); see them fail before 3.4
- [ ] 4.2 GREEN: `pnpm test:e2e` passes

## 5. Visual check and close

- [ ] 5.1 Run the app against the `dev` branch and capture `/planner` at 375 px and 1160 px, with a menu open and after choosing; note anything that clashes with the design system here
- [ ] 5.2 `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage`, `pnpm build` and `pnpm test:e2e` pass
- [ ] 5.3 Before `archive`: the checklist of `context/safety-first.md` §4, with the result recorded here; mark MF-43.2 and MF-43 done in `context/roadmap.md`
