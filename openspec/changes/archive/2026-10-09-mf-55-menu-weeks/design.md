## Context

Today `/menu` calls `webContainer().activeMenu({ userId })` ([page.tsx](../../../src/app/(signed-in)/menu/page.tsx)). `activeMenu` ([active-menu.ts](../../../src/application/use-cases/active-menu.ts)) reads the user's selections from this Monday (`currentSelections` → `SelectionRepository.listFrom`), picks the one that starts on this Monday, reads its menu with `MenuRepository.find` and lays it out with `menuWeek(menu, recipes, startsOn, today)`. `menuWeek` already takes any `startsOn`, and `find` already reads one menu by number. Both are reusable for past and next weeks.

`EmptyMenu` ([empty-menu.tsx](../../../src/features/weekly-menu/components/empty-menu.tsx)) shows "Todavía no has elegido menú para esta semana" with a link to `/planner`. That copy is wrong for a past week, so it gets a week-aware message.

## Goals / Non-Goals

**Goals:**
- Show any week in the window `[current Monday − 70 days, current Monday + 7 days]`, Monday-aligned, from the user's selections.
- Keep the back arrow enabled over empty weeks; disable it at the tenth week back and the next arrow after next week.
- Read one menu per displayed week.

**Non-Goals:**
- A history page (roadmap §2 item 5).
- Changing `/planner`, `activeMenu`, or the shopping-list selection (`currentOf`).
- Editing or deleting selections.

## Decisions

**D1. Week comes from a `startsOn=YYYY-MM-DD` query parameter, validated before use.** Alternatives were a route segment (`/menu/[startsOn]`) and a cookie. A query parameter keeps `/menu` as one route, is shareable, and needs no new route. Next 16 passes `searchParams` as a Promise whose values are `string | string[] | undefined` ([Next docs, layouts and pages](../../../node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md)), so the page passes the raw value, typed as `unknown`, to a pure domain function `resolveStartsOn(raw, today)` in `src/domain/selection/`. That function returns a `LocalDate` or the current Monday, with these steps in order:
1. Reject anything that is not a single string: arrays (repeated parameter) and `undefined` give the current Monday.
2. Reject length other than 10 before any parsing (oversized values never reach the date code).
3. Match `^\d{4}-\d{2}-\d{2}$`. Spaces, slashes and short forms fail here.
4. Parse, then format back and compare with the input. This rejects `2026-02-30`, which `Date` would otherwise roll over to March.
5. Check it is a Monday (`isMonday`).
6. Check it lies in `[today − 70 days, today + 7 days]`.

Any failure returns the current Monday; no error is shown. The raw string is never used after step 6: only the resulting `LocalDate` goes to the use case, and the repository query stays parameterised (`$2::date`). This is the exception described in the proposal.

**D2. The window is computed in the domain, enforced in the use case.** `resolveStartsOn` is the single place that knows the 10-back and 1-forward limits. The use case receives an already-resolved `startsOn`, so an out-of-window value cannot reach the repository even if the page is changed later.

**D3. A new use case `weekMenu`, not an extension of `activeMenu`.** `activeMenu` has its own tests (`active-menu.test.ts`) and keeps its current behaviour; changing its signature would touch those tests for no gain. `weekMenu({ userId, startsOn })` does: read selections from `current Monday − 70 days`, pick the one whose `startsOn` equals the requested week, `menus.find(menuNumber)` for that one menu, recipes for its dishes, and `menuWeek`. It returns `null` when the week has no selection.

**D4. Port reuse, no new port.** `weekMenu` depends on `SelectionRepository` (existing `listFrom`, which already filters by user) and `MenuRepository` (`find`) and `RecipeRepository` (`findByFiles`), all as `activeMenu` does now. `listFrom`'s `from` argument is set to `current Monday − 70 days`; its existing `>= from` semantics stay the same. No new SQL is needed beyond the existing query.

**D5. Empty-state copy depends on the week.** The current week keeps the current copy. A past or next week shows "No hay menú elegido para esta semana" with the same link to `/planner`. The component receives the week as a prop; it does not compute dates itself.

**D6. Navigation is links, not client state.** The arrows are `<Link href="/menu?startsOn=…">`, so each week is a server render and the page keeps working without JavaScript. Disabled arrows are rendered as text with `aria-disabled`, not removed, so the layout does not shift.

**D7. Date formatting** reuses `formatShortDate` in `src/features/weekly-menu/format-date.ts`; no new formatter.

## Risks / Trade-offs

- **Stale past menus.** `MenuRepository.saveAll` replaces a menu's content when it is re-ingested (see [postgres-menu-repository.ts](../../../src/infrastructure/postgres/postgres-menu-repository.ts) comments). A past week shows the menu as it is now, not as chosen. Accepted for MF-55; it is worth a line in the presentation, not a fix now.
- **Deviation D1** from the page rule that the URL does not reach the use case. Accepted by the author on 2026-10-09 because the data stays protected by the session user id. Validation (D1 steps 1–6) is the control that makes it safe.
- **Window boundary off by one.** Ten weeks back is `−70` days inclusive. Covered by a boundary scenario in `menu-selection`.
- **Time zone.** `resolveStartsOn` uses `LocalDate` and the injected `Clock`, never `Date.now()`, so tests fix "today".
