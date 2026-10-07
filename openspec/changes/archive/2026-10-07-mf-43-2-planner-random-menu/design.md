## Context

`mf-43-1-menu-selection` (archived) gives the web container `selectMenu` and `currentSelections`, with the start date computed on the server. The menus are read by `MenuRepository.list()` (`PostgresMenuRepository`), which the web container does not wire yet. `/planner` is a placeholder inside the shell (MF-51) that greets the user; `protected-pages.test.ts` fails for any page without `requireUser()`. The login form uses `useActionState` with a `{ message, attempt }` state (MF-47.2). `Button` is in `src/features/auth/components/button.tsx`.

## Goals / Non-Goals

**Goals:**
- One click gives a menu, with and without JavaScript, and shows its Monday.
- The page stays a thin adapter: session, use cases, props (ADR-001 §5).

**Non-Goals:**
- Listing the menus or their dishes; avoiding a repeated menu; a confirmation before replacing next week's choice.

## Decisions

### D1. No mock, the app's global styles
Chosen by the author on 2026-10-07: the screen is provisional and uses the tokens of `globals.css`, the shell and `Button`. No new visual component is ported.

### D2. `selectRandomMenu` reuses the ports and `selectMenu`
`src/application/use-cases/select-random-menu.ts`:
```ts
type Deps = { menus: MenuRepository; selections: SelectionRepository; clock: Clock; random: () => number };
selectRandomMenu(deps, { userId }): Promise<Result<Selection, { kind: 'no-menus' } | { kind: 'failed' }>>
```
It reads `menus.list()`, picks `numbers[Math.floor(random() * numbers.length)]` and calls `selectMenu`. No new port: `MenuRepository` and `SelectionRepository` already cover the data, and the random number is a plain function (`Math.random` in the web container), not an external boundary. `unknown-menu` from `selectMenu` (a menu removed between the read and the write) is reported as `failed`. Reading every menu with its meals to take one number costs one query over 36 menus; accepted for a provisional screen.

### D3. The feature
`src/features/menu-planner/components/`:
- `SelectionSummary`: "Esta semana" and "La semana que viene", each "Menú N · desde el lunes 5 de octubre" or "Sin elegir"; it takes `CurrentSelectionsDto | null` (null: could not be read).
- `RandomMenuForm` (client): one `<form action>` with `Button type="submit"` "Elegir un menú al azar" and the message of the last answer, in `role="status"` for a success and `role="alert"` for a failure, keyed by `attempt` so a repeated message is announced again.

`src/application/dto/selection-summary.ts` declares `SelectionSummaryDto = { menuNumber: number; startsOn: string }` and `CurrentSelectionsDto`, so `features/` does not import `domain/` (ADR-001 §3). `Button` moves to `src/shared/ui/button.tsx` with its test.

### D4. The server action checks the session first
`src/app/(app)/planner/actions.ts`: `chooseRandomMenuAction(previous)` calls `requireUser()` first, then `selectRandomMenu({ userId })`; it reads nothing from the form. Messages: success "Te ha tocado el menú 12: empieza el lunes 5 de octubre."; `no-menus` "No hay menús para elegir."; `failed` "No se ha podido elegir el menú. Inténtalo de nuevo.". Then `revalidatePath('/planner')`. `protected-pages.test.ts` also requires `await requireUser()` in every `actions.ts` under `(app)/`.

### D5. Spanish dates without the comma
`Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })` writes "lunes, 5 de octubre"; `src/features/menu-planner/format-monday.ts` joins its parts without the comma, reading the `YYYY-MM-DD` string as a UTC date, so the server's zone never shifts the day.

### D6. End-to-end test with a fictitious menu
`e2e/planner.spec.ts` inserts menu 9001 with one meal into the test database before its tests and, after them, deletes the selections of menu 9001 and the menu (MF-49: nothing left behind). Other menus may exist in the test database, so the test checks the message's shape and that the summary shows the same menu, not a fixed number. It runs once with JavaScript and once without, and posts to `/planner` without a cookie to check the redirect to `/login`.

## Risks / Trade-offs

- [The same menu can come twice in a row] → accepted; non-goal.
- [Reading every menu to take one number] → D2, accepted for 36 menus.
- [The e2e result depends on the menus in the test database] → it checks the shape, not the number.
