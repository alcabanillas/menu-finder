# Design

## Context

- **Mock:** `project/ui_kits/app/HomeScreen.jsx` (dashboard) and `project/ui_kits/app/WelcomeScreen.jsx` (informative home) of the design system "Menu Finder Design System" (https://claude.ai/artifact/6PMHm2JqbG6LvGKmZXduwF), version `1792255497-a1ff`, read on 2026-10-18, with `RecipeCard`, `ProgressBar`, `SectionHeader` and `Button`. The repo's token copy (`design-system/VERSION`) is the same version, so no token refresh is needed.
- `src/app/page.tsx` today renders `SignInScreen` without a session and a placeholder "Hoy" inside `AppShell` with one. `AppShell` without `account` already draws the visitor variant (MF-51.1 D10, MF-51.2 D5); no route mounts it.
- The data is already reachable through the web container: `menuWeekPage({ userId, startsOn })` returns this week's `MenuWeek` (with `today` and the seven days, each with lunch and dinner and their recipes) or `null`, and `shoppingChecklist({ userId })` returns the current list with `checkedCount` and `total`, `null`, or a list with `total` 0. Both take the user id from the session in `app/`.
- The sign-in destination is written twice: `redirect('/planner')` in `src/app/_auth/actions.ts` and in `redirectIfSignedIn` of `src/app/_auth/require-user.ts`.
- ADR-001 §2 (Scope Rule) already names this case: the page of `/` composes pieces of `weekly-menu` and `shopping-list`, and a feature never imports another feature (ADR-001 §3).

## Goals / Non-Goals

**Goals:**
- `/` in both states of UI-home-sin-login, decided on the server from the session.
- Dashboard: menu of this week, today's dishes, shopping progress, each with its empty state and its failure.
- The sign-in goes to `/`, still a fixed destination.
- E2E for the visitor home (the MF-51.1 warning in `context/roadmap.md`) and for the dashboard.

**Non-Goals:**
- A new use case, port or query: the two existing reads are enough (D2).
- Next week's menu on the dashboard, ticking items from it, a greeting by time of day.
- Changing `/login` (it stays outside the shell) or the sign-in form.
- A menu title: the data has none (the mock's "Una semana de cuchara" is mock data).

## Decisions

### D1. Two new features and two pieces in the existing ones; the page composes them

- `features/welcome/components/welcome-screen.tsx`: the informative home, ported from `WelcomeScreen.jsx`. Static text, the "Acceder" call to action as a link to `/login` (a link, not a button with `onClick`, so it works without JavaScript, as the shell's "Acceder" does).
- `features/dashboard/components/`: `dashboard-layout.tsx` (the mock's grid: one column on a phone; from an 800 px container, the menu and the shopping block in the first row and today's meals below) with three slots, and `active-menu-card.tsx` (the olive hero: "Menú activo", "Menú N", "Del 5 al 11 de octubre", "Ver la semana" → `/menu`, "Cambiar menú" → `/planner`; and its empty and failed states).
- `features/weekly-menu/components/today-meals.tsx`: "Qué toca hoy", the date of today and the dishes of `today` under "Comida" and "Cena", reusing `RecipeCard` and `format-date`. It lives in `weekly-menu` because it only uses that feature's pieces.
- `features/shopping-list/components/shopping-progress.tsx`: "Lista de la semana", `ProgressBar` with "Ítems marcados", "Abrir" → `/shopping-list`, and the "no list" and "not available" texts.
- `app/page.tsx` reads the session, the two use cases, and passes each piece to the layout's slots. The level-one heading "Hoy" (the app-shell scenario) is in the layout, with today's date as its eyebrow.

Alternative: one `dashboard` feature that imports `RecipeCard` and `ProgressBar`. Rejected: a feature importing another is forbidden by ESLint `boundaries`; moving both to `shared/ui/` is the other way, but the page composing features is what ADR-001 §2 says for `/`, and it moves nothing.

### D2. No new use case: the page calls `menuWeekPage` and `shoppingChecklist` in parallel

`menuWeekPage` with `startsOn: undefined` resolves to this week (`resolveStartsOn`), which is what the dashboard shows. `shoppingChecklist` already decides which list is current (`currentShoppingSelection`), which can be next week's list near the weekend; the dashboard shows that one, as `/shopping-list` does, so the two screens never disagree. The checklist carries the categories the dashboard does not need; it is one user's list of about 40 items, read in the same request.

Alternative: a `todayDashboard` use case that returns only the counts and today's day. Rejected for now: it would duplicate two reads to save a few kilobytes inside the server. If the dashboard grows, it is the place to add.

### D3. Each block fails alone

The two reads are independent `Result`s. A failed menu read shows "No se ha podido cargar tu menú." in the hero block and hides today's meals; a failed list read shows "No se ha podido cargar la lista. Inténtalo de nuevo." in the shopping block. The shell and the other block stay. Nothing of the error reaches the page; the texts are the ones `/menu` and `/shopping-list` already use for the same failure.

### D4. Today is the `today` of `MenuWeek`

`TodayMeals` takes the day whose `date` equals `menu.today`. The clock is the server's `Clock` port, the same as `/menu`, so the dashboard and `/menu` agree on what today is. With no menu this week there is no "today" block (the hero already says there is no menu).

### D5. The sign-in destination is one constant

`SIGNED_IN_HOME = '/'` in `src/app/_auth/`, used by `signInAction` and by `redirectIfSignedIn`. It is a literal; no request value reaches `redirect()`. The `?next=` tests (unit and e2e) keep their inputs and change only the expected destination.

### D6. Deviations from the mock

- The mock's `TopBar` with "Buenos días" and an account button: the account is already in the shell, and a greeting by hour needs the user's time zone. The heading is "Hoy" with today's date as eyebrow (the app-shell spec already names the heading "Hoy").
- The mock shows one dish per meal (`slice(0,1)`); the dashboard shows every dish of today's lunch and dinner, because hiding a dish of today would make the block wrong.
- No menu subtitle (see Non-Goals).
- The week's dates read "5 – 11 oct", the shared `formatWeekRange` the planner already uses, instead of the mock's "Del 5 al 11 de octubre".
- "Qué toca hoy" has no date of its own: today's date is the eyebrow of the heading "Hoy", shown only when the week's menu was read (the date comes from it).

### D7. `format-date.ts` moves to `src/shared/`

The dashboard's heading formats today's date with `formatDayDate`, which lived in `features/weekly-menu/`. A second feature uses it, so it moves up to `src/shared/format-date.ts` (Scope Rule, ADR-001 §2), next to `format-week.ts`. A move with no change of behaviour, inside this change (PROC-sdd: small refactor).

### D8. The warm button variant

The mock's "Ver la semana", "Elegir menú" and "Acceder" use the design system's `warm` variant (aceite on ink), which `shared/ui/button.tsx` had not ported. It is added there, as the other variants.

## Risks / Trade-offs

- [E2E helpers wait for `/planner` after the sign-in] → `e2e/support/test-account.ts` (`signInAs`) and every spec that asserts the destination change in the same task; a spec that needs `/planner` navigates there.
- [The shopping list shown can belong to next week while the hero shows this week] → it is the same rule as `/shopping-list` (D2); the block's label stays "Lista de la semana", as in the mock.
- [`/` now always reads the database for a signed-in user] → two reads already used by other pages; a failure is contained per block (D3).
- [The visitor home leaks something] → the welcome page is static and has no props with data; a test checks the response for the version, emails and catalogue names.
