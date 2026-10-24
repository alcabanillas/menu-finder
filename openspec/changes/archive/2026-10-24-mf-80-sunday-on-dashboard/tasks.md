# Tasks

## 1. Refactor: `page.tsx` as the router (no behaviour change)

- [x] 1.1 Extract `shellAccountOf` to `src/app/_auth/shell-account.ts` (design D1) and use it in `src/app/(signed-in)/layout.tsx`; verify `src/app/(signed-in)/layout.test.tsx` passes unchanged
- [x] 1.2 Move the visitor's content to `WelcomeContent` in `src/app/_welcome/welcome-content.tsx`, and `dashboardOf` to `dashboardContent(user)` in `src/app/_dashboard/dashboard-content.tsx`, returning `DashboardLayout` without `AppShell`; move `TodayBlock`, `dashboardWeeksOf`, `emptyWeekOf` and `listProgressOf` to `src/app/_dashboard/dashboard-blocks.tsx` (design D1). Verify `src/app/page.test.tsx` passes unchanged
- [x] 1.3 Leave `src/app/page.tsx` as in design D1: one `AppShell` with `shellAccountOf(user)`, and `await dashboardContent(user)` or `<WelcomeContent />`, with its five imports; verify `src/app/page.test.tsx` passes unchanged, `pnpm typecheck` and `pnpm exec eslint src/app --rule "import/no-cycle: off"`
- [x] 1.4 Move `selectedWeek` and `recipeFilesOf` to `src/application/services/menu/selected-week.ts` (design D3), with `menuWeekPage` calling it. RED first: `selected-week.test.ts` for a selection with its recipes and for a missing menu as a failure, seen failing before the move; verify it and `menu-week-page.test.ts` pass
- [x] 1.5 Commit the refactor on its own (`refactor(home): …`) before group 2

## 2. The use case `todaysMenu`

- [x] 2.1 Add `TodaysMenuDto` and `TomorrowDto` (`day`, `next-week` with `menuNumber` and `startsOn`, `no-menu` with `startsOn`, `none`) in `src/application/dto/todays-menu.ts` (design D2); verify `pnpm typecheck`
- [x] 2.2 RED: `src/application/use-cases/menu/todays-menu.test.ts` with a fake clock: a weekday gives today and the next day of the same week; a Sunday with next week chosen gives next week's Monday with its menu number and Monday; a Sunday with no next week gives `no-menu` with next Monday's date; a Sunday whose next Monday has no dishes gives `none`; a failed read of next week's menu gives `none` and keeps today; no menu this week gives `day: null`; a failed read of the selections or this week's menu gives `failed`; the selections are read with the given `userId` only. See them fail
- [x] 2.3 GREEN: `todaysMenu` with the service of 1.4, and `todaysMenu` in `src/composition/web/menu-use-cases.ts`; verify 2.2 and `src/composition/web-container.test.ts` pass

## 3. The dashboard on Sunday

- [x] 3.1 RED: tests in `src/features/weekly-menu/components/today-meals.test.tsx` for the scenarios "Sunday is a rest day" (card "Domingo libre", no "Ver menú"), "On Sunday, tomorrow is next week's Monday" ("Mañana · Lunes 26 · Menú 31" and the link to `/menu?startsOn=…`), "On Sunday, next week has no menu yet" (the olive-50 notice and its button) and "On Sunday, next week's Monday has no dishes", with `TodayMeals({ today, tomorrow })` (design D4); adapt the existing tests to the new props, asserting the same; see the new ones fail
- [x] 3.2 GREEN: `TodayMeals` with the two days, the "Domingo libre" card with its sun icon, the `next-week` block with its link and the `no-menu` notice with its primary button to `/planner?week=next`; verify 3.1 and the existing tests pass
- [x] 3.3 RED: in `src/features/dashboard/components/dashboard-layout.test.tsx`, the header's date on a Sunday has the thin `border-strong` border and the other days' bars have none (scenario "Sunday's colour bar shows"); see it fail. GREEN: `DashboardLayout` takes the bar classes from `DAY_BARS` (design D4).
- [x] 3.4 RED: in `src/app/page.test.tsx`, the dashboard calls `todaysMenu({ userId })` from the session and not `menuWeekPage`; the scenario "A parameter does not change whose next week is shown"; the scenario "Next week cannot be read" (tomorrow `none`, weeks and shopping kept); the existing failure tests now with `todaysMenu` failing. See them fail
- [x] 3.5 GREEN: `dashboardContent` reads `todaysMenu`, and `TodayBlock` maps it to `TodayMeals`, `NoMenuNotice` or the failure; verify 3.4 and all of `src/app` pass
- [x] 3.6 Update `e2e/home.spec.ts` "names tomorrow's dishes, except on Sunday…": on a Sunday it expects next week's Monday or the link to choose it, according to the selections the test sets up; verify with `pnpm test:e2e e2e/home.spec.ts`

## 4. Checks

- [x] 4.1 By eye at 390 px and 1440 px with the dev server, on a Sunday (or with the clock of a local branch fixed to a Sunday, not committed): the rest day, "Mañana" with next week's Monday, and "Mañana" with the link to choose next week; no horizontal scroll and no console errors
- [x] 4.2 `pnpm typecheck` and `pnpm test:coverage`

## Workflow follow-up

- `/opsx:verify`, the checklist of `context/safety-first.md` §4 and `/opsx:archive`.
- Mark MF-80 done in `context/roadmap.md`.
