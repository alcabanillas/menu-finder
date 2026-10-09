## Why

Implements **MF-55** in [context/roadmap.md](../../../context/roadmap.md) (line 108, ~2 h, depends on MF-23, done).

`/menu` only shows the week in progress. A menu the user has already chosen for next week, in `/planner`, is not visible, and past weeks cannot be consulted: `CurrentSelections` reads selections only from this Monday onwards (`listFrom`, [postgres-selection-repository.ts](../../../src/infrastructure/postgres/postgres-selection-repository.ts)).

Decisions taken by the author on 2026-10-09 (recorded in the MF-55 roadmap entry):

- Backwards: up to 10 weeks from the current one. The back arrow is always enabled, even when the week has no menu, until the 10th week.
- Forwards: only the next week.
- A week with no menu shows the existing `EmptyMenu` with a link to `/planner`.

## What Changes

- `/menu` gets week navigation in its header: previous arrow, next arrow, and a "this week" action.
- The selection read is bounded to the 10 weeks back, not to this Monday. It stays per user.
- The menu of the displayed week is read with `MenuRepository.find` for its single number. `list()` is not used.
- The week is taken from the query parameter `startsOn=YYYY-MM-DD`, validated as described in the `weekly-menu` delta spec. Anything invalid or outside the window falls back to the current week.

Out of scope: a history page (roadmap §2, item 5, still open), reactivating a past menu, and changes to `/planner` or the shopping list.

## Data touched

- `selection`: the user's own rows. Read only.
- `menu`, `meal`, `menu_dish`, `recipe`: read by menu number. No writes.
- No nutritionist data is added to the repo, logs or Sentry. Menu and recipe text is already rendered by `/menu` today.

## Possible abuses

- **Reading another user's selections** by altering a week parameter or the query. Mitigation: the user id comes from the session only, as in `CurrentSelectionsInput` today.
- **Malformed or extreme date parameter** (non-date text, impossible dates such as `2026-02-30`, repeated parameters, oversized values, SQL-shaped text). Mitigation: the strict validation in `design.md` D1, with negative scenarios in the spec. Only the validated `LocalDate` reaches the use case.
- **Navigating to a future week beyond the next one** through a hand-edited URL. Mitigation: same window check on the server, not only in the UI.

## OWASP categories

- A01 Broken Access Control: the selection read must filter by the session user. Negative scenarios are required in the spec.
- A03 Injection: `startsOn` is validated to a date before any use and reaches SQL only as a bound `$2::date` parameter.
- A04 Insecure Design: the 10-week limit is enforced in the use case, not only in the UI.

## Decisions relied on

- **UI-flujo-semanal**: "histórico intacto". Past selections are read, never changed.
- **UI-card-receta**: the recipe card still opens inside `/menu`; no new route.
- **UI-estilos**: Tailwind v4, same as the current `/menu`.
- **SEG-roles**: one role, registered user. No admin view.
- **SEG-owasp**: see above.
- **ARQ-hexagonal**: reuse `SelectionRepository` and `MenuRepository` (port reuse rule in [AGENTS.md](../../../AGENTS.md)). No new port. The domain function that lays a week out is `menuWeek`, which already takes `startsOn`.
- **Scope Rule** (ADR-001 §2): the header navigation lives in `features/weekly-menu/` and receives its data and actions through props. Only `app/` touches the web container.

## Contradictions with existing sources

- The roadmap §2 item 5 leaves open what a history page shows. This change adds navigation to `/menu`, not that page, so it does not decide that item.
- `app/(signed-in)/menu/page.tsx` declares no `searchParams` on purpose: "nothing from the URL reaches the use case". This change reads `startsOn`. The user id still comes only from the session; the URL carries a validated date that selects which week to show. The author accepted this exception on 2026-10-09; the page comment must be updated to say so.
- The capability `menu-selection` documents that reads start from this Monday ([openspec/specs/menu-selection](../../specs/menu-selection)). This change extends that rule with a bounded look-back. The delta spec states the change explicitly; the archived spec is not overwritten by this proposal.

## Impact

- Capabilities affected: `weekly-menu` (navigation and empty week) and `menu-selection` (bounded look-back read).
- Estimated effort: about 2 hours, under the 2-hour split threshold in [AGENTS.md](../../../AGENTS.md), so no roadmap split.
