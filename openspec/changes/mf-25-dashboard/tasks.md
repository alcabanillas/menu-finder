# Tasks

Each test task is written first and seen failing before its implementation task (PROC-tdd). During `apply`, run only the affected tests (`pnpm exec vitest run <files>`) and `pnpm typecheck`; lint only touched files with `pnpm exec eslint <files> --rule "import/no-cycle: off"`.

## 1. Sign-in destination (authentication)

- [x] 1.1 Test: `src/app/_auth/actions.test.ts` expects `redirect('/')` after a correct sign-in, also when the form carries `next`/`callbackURL`/`redirect`/`returnTo`; `current-user.test.ts` expects `redirectIfSignedIn` to throw `redirect:/`. Seen failing
- [x] 1.2 Add `SIGNED_IN_HOME = '/'` in `src/app/_auth/` and use it in `actions.ts` and `require-user.ts` (design D5). Tests of 1.1 green

## 2. Informative home (home, app-shell)

- [x] 2.1 Test `src/features/welcome/components/welcome-screen.test.tsx`: level-one heading, the description, a link "Acceder" to `/login`; no control to create an account or recover a password. Seen failing
- [x] 2.2 Port `WelcomeScreen.jsx` (version `1792255497-a1ff`) to `src/features/welcome/components/welcome-screen.tsx` on the app's tokens, "Acceder" as a link (design D1). Test 2.1 green

## 3. Dashboard pieces

- [x] 3.1 Test `src/features/dashboard/components/active-menu-card.test.tsx`: with a menu, "Menú 12", the week's first and last date, links to `/menu` and `/planner`; without one, the "no menu this week" text and a link to `/planner`; failed, "No se ha podido cargar tu menú." with no detail. Seen failing
- [x] 3.2 Implement `active-menu-card.tsx` after the mock's hero. Test 3.1 green
- [x] 3.3 Test `src/features/weekly-menu/components/today-meals.test.tsx`: shows today's date and only today's lunch and dinner dishes under "Comida" and "Cena"; a dish with a recipe unfolds it (`aria-expanded`); a dish without one says "Sin receta". Seen failing
- [x] 3.4 Implement `today-meals.tsx` reusing `RecipeCard` and `format-date` (design D1, D4). Test 3.3 green
- [x] 3.5 Test `src/features/shopping-list/components/shopping-progress.test.tsx`: a progress bar "5 de 40" and a link "Abrir" to `/shopping-list`; with no list, the "no list yet" text and no progress bar; with total 0, the "not available" text and no "0 de 0"; failed, "No se ha podido cargar la lista. Inténtalo de nuevo.". Seen failing
- [x] 3.6 Implement `shopping-progress.tsx` reusing `ProgressBar`. Test 3.5 green
- [x] 3.7 Test `src/features/dashboard/components/dashboard-layout.test.tsx`: the heading "Hoy" with today's date and the three slots in the mock's order. Seen failing
- [x] 3.8 Implement `dashboard-layout.tsx` with the mock's grid (one column; from an 800 px container, menu and shopping in the first row, today below). Test 3.7 green

## 4. The page `/`

- [x] 4.1 Test `src/app/page.test.tsx` (replacing the placeholder and sign-in cases): without a session, the welcome inside the shell's visitor variant, no version, no email, no catalogue name; with a session, the dashboard with the user id from the session only (a `userId` search param is ignored); a failed menu read keeps the shopping block, and a failed list read keeps the menu block. Seen failing
- [x] 4.2 Rewrite `src/app/page.tsx`: session → `menuWeekPage({ userId, startsOn: undefined })` and `shoppingChecklist({ userId })` in parallel → layout slots; no session → `<AppShell>` without account + `WelcomeScreen` (design D2, D3). Remove `TodayPage`. Test 4.1 green

## 5. E2E

- [x] 5.1 `e2e/support/test-account.ts`: `signInAs` waits for `/`; update `sign-in.spec.ts` (correct credentials and `?next=` end on `/`; already signed in on `/login` goes to `/`), `access.spec.ts`, `app-shell.spec.ts`, `planner.spec.ts` and `weekly-flow.spec.ts` where they assume `/planner` after the sign-in. Run them against the test database
- [x] 5.2 New e2e `e2e/home.spec.ts`: a visitor sees the welcome with the shell's "Acceder", follows it to `/login`, and the response has no version; a signed-in user with no menu sees the empty states; after choosing a menu for this week, sees "Menú N", today's dishes and the progress bar; ticking an item in `/shopping-list` moves the progress. Seen failing first, then green

## 6. Docs and checks

- [x] 6.1 `context/decisiones.md` UI-home-sin-login: remove the "Por ahora" sentence; `context/roadmap.md`: mark MF-25 done with the link to the change; remove the MF-51.1 warning from MF-25's line
- [x] 6.2 Verify against the mock: screenshots of `/` with and without a session at 375 px and 1024 px compared with `HomeScreen.jsx` and `WelcomeScreen.jsx`; the deviations are those in design D6
- [x] 6.3 `pnpm typecheck` and `pnpm test:coverage` pass before opening the PR
- [x] 6.4 Refactor (no behaviour change, PROC-sdd): `CurrentSelections.shoppingList` is renamed `shoppingSelection` in `src/domain/selection/`, because it holds the selection the current list comes from, not a list. `week.test.ts` and `current-shopping-selection.ts` follow. In the same refactor, `activeMenu` becomes `thisWeekSelection`, `currentOf` names `nextWeekSelection` so the fallback reads `nextWeekSelection ?? thisWeekSelection`, and `thisWeekIsFree` in `suggestedWeek` becomes `thisWeekIsOpenAndEmpty`

## 7. Redesign after the manual check (mock `HomeScreen.jsx` version `1792319321-0ddf`)

- [x] 7.1 Test `src/application/use-cases/menu/menu-week-page.test.ts`: the result carries `today`, the clock's date, with and without a menu. Seen failing
- [x] 7.2 Add `today` to `MenuWeekPage` (design D2). Test 7.1 green
- [x] 7.3 Test `src/features/dashboard/components/weeks-card.test.tsx`: both weeks with a menu (dates, "Menú 26", "Menú 31", no "Elegir"); next week empty ("Sin elegir", link "Elegir" to `/planner?week=next`); this week empty ("Sin menú", hidden below 800 px); failed ("No se ha podido cargar tu menú."). Seen failing
- [x] 7.4 Implement `weeks-card.tsx`; remove `active-menu-card.tsx` and its test. The arrow of the mock's buttons moves from `welcome-screen.tsx` to `src/shared/ui/arrow-right.tsx`, now used by four features (Scope Rule). Test 7.3 green
- [x] 7.5 Test `src/features/dashboard/components/no-menu-notice.test.tsx`: open ("Esta semana aún no tiene menú", link to `/planner?week=current`); locked ("Esta semana no tiene menú", "Menú 31", link to `/menu?startsOn=<next Monday>`). Seen failing
- [x] 7.6 Implement `no-menu-notice.tsx`. Test 7.5 green
- [x] 7.7 Update `today-meals.test.tsx`: no heading of its own; empty meals hidden; "El menú no incluye platos para hoy." when today has no dishes; link "Ver menú" to `/menu`. Seen failing
- [x] 7.8 Update `today-meals.tsx` (design D1). Test 7.7 green
- [x] 7.9 Update `shopping-progress.test.tsx`: title "Compra · semana del 19 oct" from the list's `startsOn`, "Marcados", no list says "Aún no hay lista: aparece al elegir un menú." without "Abrir". Seen failing
- [x] 7.10 Update `shopping-progress.tsx`. Test 7.9 green
- [x] 7.11 Update `dashboard-layout.test.tsx`: heading "Qué toca hoy" with the date and the day's colour, no heading "Hoy"; slots in the mock's order (weeks, today, shopping). Seen failing
- [x] 7.12 Update `dashboard-layout.tsx` with the mock's grid (design D1). Test 7.11 green
- [x] 7.13 Update `src/app/page.test.tsx`: three reads with the session's user id; the notice open and locked; each read failing alone (design D3). Seen failing
- [x] 7.14 Update `src/app/page.tsx` (design D2, D3). Test 7.13 green
- [x] 7.15 Update `e2e/home.spec.ts` and `e2e/app-shell.spec.ts` for the new heading and texts; add the locked notice. Run them against the test database
- [ ] 7.16 Verify against the mock at 375 px and 1280 px, with the server clock on a weekday with dishes, and on a Sunday; then remove the temporary clock in `src/composition/web/infrastructure-deps.ts`
- [x] 7.17 `pnpm typecheck` and `pnpm test:coverage` pass

## 8. Today on desktop and tomorrow (mock `HomeScreen.jsx` version `1792323100-d95a`, design D9)

- [x] 8.1 Test `src/features/weekly-menu/components/recipe-panel.test.tsx`: `sideAwayFrom` puts the panel away from the dish. Seen failing
- [x] 8.2 Move `sideAwayFrom` from `weekly-menu.tsx` to `recipe-panel.tsx`. Test 8.1 and `weekly-menu.test.tsx` green
- [x] 8.3 Update `today-meals.test.tsx`: from 800 px, dish rows with their time; a recipe dish opens `RecipePanel` (dialog, `aria-expanded`), Escape closes it and the focus returns; the phone view keeps `RecipeCard`. Seen failing
- [x] 8.4 Update `today-meals.tsx` (design D9). Test 8.3 green
- [x] 8.5 Test `today-meals.test.tsx`: "Mañana · sábado 17" with the names of tomorrow's dishes, no controls; no "Mañana" when tomorrow has no dishes or today is Sunday. Seen failing
- [x] 8.6 Implement tomorrow in `today-meals.tsx`. Test 8.5 green
- [x] 8.7 Update `e2e/home.spec.ts`: at 1280 px the recipe opens in the panel; at 390 px the meals unfold in place; tomorrow's names, none on Sunday. Run it against the test database (the tomorrow test, and two of `e2e/menu.spec.ts`, need the temporary clock gone: task 7.16)
- [x] 8.8 Compare with the mock at 1280 px, 1536 px and 390 px; on a Saturday, no "Mañana"

## 9. Tomorrow as boxes at every width (mock `HomeScreen.jsx` version `1792337560-ff39`, design D9)

- [x] 9.1 Update `today-meals.test.tsx`: "Ver menú" comes before "Mañana"; tomorrow is one piece, a box per meal with a dish per line, one column on a phone and two from 800 px. Seen failing
- [x] 9.2 Update `today-meals.tsx`. Test 9.1 green
- [x] 9.3 Check at 390 px and 1280 px

## Safety review (`context/safety-first.md` §4)

- Business and security decisions in the backend: `/` decides its state on the server from the session (`sessionUser`); the welcome page is static and takes no data.
- New endpoint: none. The sign-in server action only changes its fixed destination to `SIGNED_IN_HOME = '/'`.
- User and permissions from the session: the dashboard reads with the session's `userId` only; `page.test.tsx` checks that a `userId` search param is ignored.
- Negative tests: forged cookie on `/` (`e2e/home.spec.ts`), revoked cookie on `/` (`e2e/sign-in.spec.ts`, sign-out), `?next=` and the other redirect targets ignored (`actions.test.ts`, `sign-in.spec.ts`); they run in CI.
- Minimum data returned: the dashboard shows the menu number, dates, today's dishes and two counts; the visitor response has no version, email or catalogue name (tested). Failures show a fixed text, no error detail.
- Secrets: none in the diff.
- New dependencies: none.
- Database queries: none new; the page reuses `menuWeekPage` and `shoppingChecklist`.
- Unexpected input: no new input. Nothing reaches the LLM.
- Sensitive actions logged: the sign-in and its logging are unchanged.
- Deviation from a rule: none.

## Workflow follow-up

- On `archive`, point the link of MF-25 in `context/roadmap.md` to the archived folder.

- Before `archive`, go through `context/safety-first.md` §4 and record the result.
- Before `gh pr create`, ask the author whether the PR bumps `"version"` in `package.json`.
