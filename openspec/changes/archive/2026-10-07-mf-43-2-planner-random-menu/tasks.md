## 1. The use case (TDD)

- [x] 1.1 RED: `select-random-menu.test.ts` with in-memory repositories, a fixed clock and a fixed random: "Choosing a random menu"; "Every menu can be picked" (random 0 and 0.999…); "No menus stored"; a read failure of the menus and of the selections, and `unknown-menu`, give `failed`; see them fail
- [x] 1.2 GREEN: `select-random-menu.ts` (design D2); `selectRandomMenu` in `web-container.ts` with `PostgresMenuRepository` and `Math.random`, and its test

## 2. The feature (TDD)

- [x] 2.1 Move `Button` and its test to `src/shared/ui/`; the auth tests still pass
- [x] 2.2 RED: `format-monday.test.ts`: 2026-10-05 gives "lunes 5 de octubre", 2026-12-28 gives "lunes 28 de diciembre"; see them fail
- [x] 2.3 GREEN: `format-monday.ts` (design D5)
- [x] 2.4 RED: `selection-summary.test.tsx` ("Nothing chosen", "This week and next week chosen", "The selections cannot be read") and `random-menu-form.test.tsx` (a submit button "Elegir un menú al azar"; a success in a status region, a failure in an alert); see them fail
- [x] 2.5 GREEN: the components and `selection-summary.ts` (design D3)

## 3. The page and its action (TDD)

- [x] 3.1 RED: `actions.test.ts` with the session and the web container mocked: "Choosing a random menu" (message and `revalidatePath`); "No menus stored"; "The database fails"; "Choosing without a session" (redirect, `selectRandomMenu` never called); "Fields in the request are ignored" (`selectRandomMenu` gets only the session's user); extend `protected-pages.test.ts` to `(app)/**/actions.ts`; see them fail
- [x] 3.2 GREEN: `actions.ts` (design D4)
- [x] 3.3 RED: `planner/page.test.tsx`: keeps "Hola, {name}" and no main landmark; shows the summary and the form; when `currentSelections` fails it says the menu could not be loaded; see them fail
- [x] 3.4 GREEN: `page.tsx`

## 4. End-to-end (design D6)

- [x] 4.1 `e2e/planner.spec.ts`: "Choosing a random menu", "Choosing without JavaScript", "Choosing without a session"
- [x] 4.2 `pnpm test:e2e` passes

## 5. Check and close

- [x] 5.1 Capture `/planner` at 375 px and 1160 px after choosing. Done on the production build against the `test` branch with a fictitious account (signing in on `dev` needs a real password); the message was left-aligned under the centred button on mobile, now centred; nothing else clashes
- [x] 5.2 `pnpm typecheck`, `pnpm lint`, `pnpm test:run`, `pnpm test:coverage` and `pnpm build` pass
- [x] 5.3 Before `archive`: the checklist of `context/safety-first.md` §4, with the result recorded here; mark MF-43.2 and MF-43 done in `context/roadmap.md`
  - Business rules in the backend: yes, the menu is picked and its Monday computed on the server
  - The new endpoint (`chooseRandomMenuAction`) checks the session first and reads no field of the request; `protected-pages.test.ts` fails for an action under `(app)/` without `requireUser()`
  - User from the session: yes; "Fields in the request are ignored" is tested
  - Negative authorization tests in CI: "Choosing without a session" in `actions.test.ts` and in `e2e/planner.spec.ts`
  - Minimum data: the page gets only the menu number and Monday of each selection
  - No secrets in the diff; no new dependencies
  - Parameterised queries: no new production queries; the e2e queries use `$n`
  - Unexpected values: the action takes no input; extra fields are ignored (tested)
  - Logs: choosing a menu is not a sensitive action; nothing logged
  - Deviations from a MUST rule: no mock of the screen (UI-design-system), chosen by the author on 2026-10-07 (design D1)
