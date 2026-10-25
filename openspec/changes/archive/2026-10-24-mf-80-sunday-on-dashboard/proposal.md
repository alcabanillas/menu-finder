# Proposal

Roadmap item: **MF-80** (`context/roadmap.md`).

## Why

On Sunday the dashboard's "Qué toca hoy" is always empty. The nutritionist leaves every Sunday free as a rest day: the 72 empty meals of the dataset are all Sundays (`context/tareas/T2-esquema-json-ingesta.md`). The page says "El menú no incluye platos para hoy." and hides "Mañana", because Monday falls in another week (`TodayMeals` in `src/features/weekly-menu/components/today-meals.tsx`). Sunday is when a user looks at the week ahead, and the demo of the master will be on a Sunday. The page shows nothing just when it is most useful.

Changing this today means touching `src/app/page.tsx`, which holds the router between the two states of `/`, the visitor's home with its samples, the three reads of the dashboard, the today block and four mappers. The change also moves that code out, so `page.tsx` only picks the state.

## What Changes

- On Sunday, when today has no dishes, the today block shows the grey card "Domingo libre" (sun icon, no "Ver menú") instead of "El menú no incluye platos para hoy.". The white colour bar of Sunday gets a thin `border-strong` border in the dashboard's header, as it already has elsewhere. Visuals and copy are the design system v90 (row v89).
- On Sunday, "Mañana" shows next week's Monday ("Mañana · Lunes 26 · Menú 31"): the names of its lunch and dinner dishes and a link to that week's menu, when next week has a menu. When next week has none, an olive-50 notice says so and has a primary button to `/planner?week=next`. Today the block is hidden on Sunday.
- A new use case reads what is on today and tomorrow for the dashboard, also across the end of the week. It replaces the dashboard's call to `menuWeekPage`, which stays for `/menu`. The step "the menu a selection chose, with its recipes" moves from `menuWeekPage` to a service, so both use cases share it (ADR-001 §3, services). No new port: it reads with `SelectionRepository`, `MenuRepository`, `RecipeRepository` and `Clock`.
- Refactor, with no change of behaviour: `src/app/page.tsx` becomes only the router between `WelcomeScreen` and `DashboardLayout`. The visitor's home goes to `src/app/_welcome/`, and the dashboard's reads and its today block go to `src/app/_dashboard/`. Per PROC-sdd, a refactor with no behaviour change rides in the open change as its own tasks; it does not get a change of its own.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `home`: "The dashboard shows what is on today" gains the Sunday rest day; "The dashboard shows the names of tomorrow's dishes" shows next week's Monday on Sunday, or the way to choose next week's menu, instead of hiding the block.

## Impact

- Code: `src/app/page.tsx`, new `src/app/_dashboard/`, `src/app/_welcome/` (one more file), a new use case in `src/application/use-cases/menu/`, a new service in `src/application/services/menu/`, `menu-week-page.ts` (uses the service), `src/composition/web/menu-use-cases.ts`, `TodayMeals` (gets today and tomorrow instead of the whole week), their tests and `e2e/home.spec.ts` (the Sunday case).
- Decisions it relies on: UI-home-sin-login (the server decides the state from the session), UI-flujo-semanal, UI-paneles-laterales (unchanged), UI-design-system (the Sunday states are drawn in the design system v90, `design-system/VERSION` `1792837273-291e`; `tokens.json` did not change from v84).
- Data touched: read-only, the signed-in user's selections of this week and next week, and the menus and recipes they point to. Nothing is written.
- Possible abuses and OWASP: A01 Broken Access Control: reading another user's next week. The new use case gets the user id only from the session, as the rest of the dashboard does, and reads nothing of the request. No new endpoint, input or query parameter; no new data from the nutritionist leaves `data/` (SEG-datos-nutricionista).
- Size: about 2.5 h (1 h of refactor, 1.5 h for Sunday). Above the 2 h threshold of PROC-sdd; it is not split, because the refactor alone cannot be its own change.
