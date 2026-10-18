# Design

## Context

- **Mock:** `project/ui_kits/app/HomeScreen.jsx` (dashboard), version `1792319321-0ddf`, and `project/ui_kits/app/WelcomeScreen.jsx` (informative home), version `1792255497-a1ff`, of the design system "Menu Finder Design System" (https://claude.ai/artifact/6PMHm2JqbG6LvGKmZXduwF), read on 2026-10-18, with `RecipeCard`, `ProgressBar` and `Button`. The author redrew the dashboard during `apply` after a manual check; the tokens it uses (`olive-50`, `olive-100`, `border-strong`, `border-hairline`, `surface-card`, `aceite-300`, the day colours) are already in `src/app/theme.css`, so no token refresh is needed.
- `src/app/page.tsx` rendered `SignInScreen` without a session and a placeholder "Hoy" inside `AppShell` with one. `AppShell` without `account` already draws the visitor variant (MF-51.1 D10, MF-51.2 D5); no route mounted it.
- The data is already reachable through the web container: `menuWeekPage({ userId, startsOn })` returns this week's `MenuWeek` (the seven days, each with lunch and dinner and their recipes) or `null`; `weeksToChoose({ userId })` returns this week and next week with their menu number, dates and lock; `shoppingChecklist({ userId })` returns the current list with its `startsOn`, `checkedCount` and `total`, `null`, or a list with `total` 0. All take the user id from the session in `app/`.
- The sign-in destination was written twice: `redirect('/planner')` in `src/app/_auth/actions.ts` and in `redirectIfSignedIn` of `src/app/_auth/require-user.ts`.
- ADR-001 §2 (Scope Rule) already names this case: the page of `/` composes pieces of `weekly-menu` and `shopping-list`, and a feature never imports another feature (ADR-001 §3).

## Goals / Non-Goals

**Goals:**
- `/` in both states of UI-home-sin-login, decided on the server from the session.
- Dashboard: what is on today first, this week and next week, the shopping progress, each with its empty state and its failure.
- The sign-in goes to `/`, still a fixed destination.
- E2E for the visitor home (the MF-51.1 warning in `context/roadmap.md`) and for the dashboard.

**Non-Goals:**
- A new use case, port or query: the three existing reads are enough (D2).
- Ticking items from the dashboard, a greeting by time of day.
- Changing `/login` (it stays outside the shell) or the sign-in form.
- A menu title: the data has none (the mock's "Una semana de cuchara" is mock data).

## Decisions

### D1. Pieces in `dashboard`, `weekly-menu` and `shopping-list`; the page composes them

- `features/welcome/components/welcome-screen.tsx`: the informative home, ported from `WelcomeScreen.jsx`. Static text, the "Acceder" call to action as a link to `/login` (a link, not a button with `onClick`, so it works without JavaScript, as the shell's "Acceder" does).
- `features/dashboard/components/dashboard-layout.tsx`: the mock's grid. On a phone one column: weeks card, today, shopping. From an 800 px container two columns, `minmax(0,1fr) 340px` (380 px from 1100 px): today on the left, the weeks card and the shopping on the right. The eyebrow with today's date and the day's colour bar and the level-one heading "Qué toca hoy" belong to the today column.
- `features/dashboard/components/weeks-card.tsx`: this week and next week in one card. With a menu this week, the olive hero; without one, a card with a dashed border, shown only from 800 px. Next week below a thin line: "Menú N" with its dates, or "Sin elegir" and "Elegir" to `/planner?week=next` (warm on the hero, secondary on the dashed card).
- `features/dashboard/components/no-menu-notice.tsx`: the olive-50 notice that replaces today's dishes when this week has no menu, open (link to `/planner?week=current`) or locked (next week's menu named, link to `/menu?startsOn=<next Monday>`).
- `features/weekly-menu/components/today-meals.tsx`: lunch and dinner of `today`, one below the other, each under its label with the ink line; empty meals hidden; "El menú no incluye platos para hoy." when both are empty; "Ver menú" (ghost) to `/menu` at the end. It reuses `RecipeCard` and lives in `weekly-menu` because it only uses that feature's pieces.
- `features/shopping-list/components/shopping-progress.tsx`: a hairline card, "Compra · semana del 19 oct", "Abrir" to `/shopping-list` and `ProgressBar` with "Comprado" (the author changed the mock's "Marcados" after the manual check, also in `/shopping-list` and in the mock). The week in the title ("semana del 19 oct") never breaks across lines: in the 340 px column "oct" fell alone on a second line; now the whole week moves to the next line if it does not fit.
- `app/page.tsx` reads the session and the three use cases, and passes each piece to the layout's slots.

Alternative: one `dashboard` feature that imports `RecipeCard` and `ProgressBar`. Rejected: a feature importing another is forbidden by ESLint `boundaries`; the page composing features is what ADR-001 §2 says for `/`.

### D2. No new use case: the page calls `menuWeekPage`, `weeksToChoose` and `shoppingChecklist` in parallel

- `menuWeekPage` with `startsOn: undefined` resolves to this week: today's dishes. It gains `today` in its result (the clock's date), because the heading shows today's date also when the week has no menu; `/menu` ignores it.
- `weeksToChoose` gives this week and next week with menu number, dates and lock, the same data the planner's selector shows: the weeks card and the notice (open or locked) come from it, so the dashboard and Buscar never disagree on whether this week can still change.
- `shoppingChecklist` already decides which list is current (`currentOf`: next week's selection if chosen, otherwise this week's). The title "Compra · semana del …" formats the list's own `startsOn`, so it never disagrees with `/shopping-list`.

Alternative: a `todayDashboard` use case that returns only what the dashboard draws. Rejected for now: it would duplicate three reads to save a few kilobytes inside the server. If the dashboard grows, it is the place to add.

### D3. Each block fails alone

The three reads are independent `Result`s. A failed menu read shows "No se ha podido cargar tu menú." in the today block. A failed weeks read shows the same text in the weeks card; with no menu this week the notice needs the weeks, so the today block shows that text too. A failed list read shows "No se ha podido cargar la lista. Inténtalo de nuevo." in the shopping block. The shell and the other blocks stay. Nothing of the error reaches the page; the texts are the ones `/menu` and `/shopping-list` already use for the same failure.

### D4. Today is the clock's date

`TodayMeals` takes the day whose `date` equals `menu.today`, and the heading's date is `menuWeekPage`'s `today`. The clock is the server's `Clock` port, the same as `/menu`, so the dashboard and `/menu` agree on what today is. The day's colour bar is the weekday of that date.

### D5. The sign-in destination is one constant

`SIGNED_IN_HOME = '/'` in `src/app/_auth/`, used by `signInAction` and by `redirectIfSignedIn`. It is a literal; no request value reaches `redirect()`. The `?next=` tests (unit and e2e) keep their inputs and change only the expected destination.

### D6. Deviations from the mock

- The mock's menu name ("Una semana de cuchara") is not shown: the data has no menu titles.
- The mock derives the shopping week from "next week has a menu"; the dashboard takes it from the list (D2). Same result, one source.
- The mock's code comment says the locked notice has no button, while its code draws "Ver el menú de la semana que viene"; the dashboard follows the code and the author's description.
- The mock has no failure states nor the "list not available" state (total 0); the dashboard keeps the texts of `/menu` and `/shopping-list` (D3).

### D7. `format-date.ts` moves to `src/shared/`

The dashboard's heading formats today's date with `formatDayDate`, which lived in `features/weekly-menu/`. A second feature uses it, so it moves up to `src/shared/format-date.ts` (Scope Rule, ADR-001 §2), next to `format-week.ts`. A move with no change of behaviour, inside this change (PROC-sdd: small refactor).

### D8. The warm button variant

The mock's "Elegir" on the hero and "Acceder" use the design system's `warm` variant (aceite on ink), which `shared/ui/button.tsx` had not ported. It is added there, as the other variants.

## Risks / Trade-offs

- [E2E helpers wait for `/planner` after the sign-in] → `e2e/support/test-account.ts` (`signInAs`) and every spec that asserts the destination change in the same task; a spec that needs `/planner` navigates there.
- [`/` now always reads the database three times for a signed-in user] → three reads already used by other pages, in parallel; a failure is contained per block (D3).
- [On a phone with no menu this week, next week's "Elegir" is not on the page] → the mock hides the weeks card there because the notice already says this week has no menu; next week is still one tap away in Buscar.
- [The visitor home leaks something] → the welcome page is static and has no props with data; a test checks the response for the version, emails and catalogue names.
