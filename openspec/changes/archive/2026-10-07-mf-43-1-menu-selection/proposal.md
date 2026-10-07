## Why

Roadmap item **MF-43.1**, the first of the two subtasks of MF-43 (`context/roadmap.md`). The weekly flow (`context/decisiones.md` UI-flujo-semanal) starts when the user chooses one of the 36 menus, and nothing stores that choice yet: `context/decisiones.md` ARQ-modelo-datos names `Selection(userId, menuId, selectedAt)`, but no table, port or use case exists. MF-43.2 (the `/planner` screen), MF-23 (`/menu`), MF-24 (`/shopping-list`) and MF-25 (the dashboard) all read it.

The author decided the timing rules in the conversation of 2026-10-07: the shopping is often done on Friday, so a menu is chosen ahead of its week. A menu always starts on a Monday and ends on the Sunday of that week; the shopping list of a menu becomes the current list the moment it is chosen, while the menu of the running week stays active until its Sunday.

**Result:** the integration tests against the Neon `test` branch store a selection and read it back with the right start date.

## What Changes

- **Table `selection`** (migration `005-selection.sql`): `id`, `user_id`, `menu_number`, `selected_at`, `starts_on`. `starts_on` is always a Monday (a `CHECK`), and a user has at most one selection per Monday (`UNIQUE (user_id, starts_on)`). Rows are never deleted by time, so expired selections are the history.
- **The start-date rule**, a pure function of the domain: if the user has no menu for the current week, the new menu starts on this week's Monday (today, if today is Monday); if there is one, it starts on next Monday. The server computes it; the client never sends a date.
- **Choosing again for the same Monday replaces the earlier choice** for that Monday (a new row with a new id, so per-selection data of MF-24 starts empty).
- **Reading the selections**: the **active menu** is the selection whose week (Monday to Sunday) contains today; the **current shopping list** is the selection of next Monday if there is one, otherwise the active one. A user with neither gets none of each.
- **New port `SelectionRepository`** with a Postgres adapter, and a **`Clock` port** for today's date in Europe/Madrid (`context/adr/ADR-001-arquitectura-interna.md` §4 lists `ClockPort` among the ports).
- **Two use cases**, wired in the web container: `selectMenu` and `currentSelections`. No screen in this change; MF-43.2 mounts them.
- **Left out:** the `/planner` screen and its server action (MF-43.2); a page of past selections (`context/decisiones.md` §2, point 5, still open); correcting the menu of the running week once chosen: choosing again then targets next Monday (accepted by the author for the MVP).

## Capabilities

### New Capabilities
- `menu-selection`: which menu a user has chosen for which week, how the start date is computed, and which selection is the active menu and which the current shopping list.

### Modified Capabilities
- None.

## Impact

- **Code:** new `postgres/migrations/005-selection.sql`; `src/domain/selection/` (the `Selection` type and the week rules); `src/application/ports/selection-repository.ts` and `src/application/ports/clock.ts`; `src/application/use-cases/select-menu.ts` and `current-selections.ts`; `src/infrastructure/postgres/postgres-selection-repository.ts`; `src/infrastructure/clock/system-clock.ts`; `src/composition/web-container.ts` wires both use cases. Tests beside each file.
- **Dependencies:** none new. `gen_random_uuid()` is built into PostgreSQL 13 and later.
- **Decisions relied on:** ARQ-modelo-datos (adds `starts_on` and an `id` to `Selection`, and uses `menu_number` as the rest of the model does; the entry is updated at archive), UI-flujo-semanal, ARQ-hexagonal and ADR-001 §3, §4 and §5, SEG-roles, OPS-ramas-bd. It **refines** ARQ-modelo-datos: there, "the current one is the last"; here the active menu is chosen by date and the current shopping list by the next Monday. It also anticipates a change to `UserShoppingItem` (MF-24): it should hang from `selection.id`, not from `(userId, menuNumber)`, or choosing the same menu twice would bring back old ticks. The author confirmed it on 2026-10-07 and it is already in `context/decisiones.md` ARQ-modelo-datos; MF-24 builds it.
- **Data:** per-user rows (user id, menu number, two dates). No personal data beyond the user id; nothing from the nutritionist. The user id comes from the session, never from the client (MF-43.2).
- **Abuses and OWASP:**
  - Writing or reading another user's selection (A01, broken access control): the use cases take the user id as an argument that the web adapter takes from the session; every query of the adapter filters by `user_id`, and a negative scenario checks that one user's selection is invisible to another and does not change the other's start date. Until MF-48 there is no RLS policy, so this filter is the only barrier (`context/roadmap.md` MF-48).
  - Tampered input (A03 injection, A04 insecure design): the menu number is validated as a positive integer in the use case and the queries are parameterised; a number with no menu is refused through the foreign key. The start date is never read from the request.
  - Flooding selections (A04): each user has at most one row per Monday, so repeated choices replace, they do not pile up. Rate limiting is MF-21.
  - Losing data on re-ingestion: `pnpm ingest menu` deletes and reinserts `menu` rows (`src/infrastructure/postgres/postgres-menu-repository.ts`). The foreign key is deferred so that re-ingesting neither deletes selections nor fails (design D3).
