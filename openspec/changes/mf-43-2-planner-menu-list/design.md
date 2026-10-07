## Context

`mf-43-1-menu-selection` gives the web container `selectMenu({ userId, menuNumber })` and `currentSelections({ userId })` (its design D6), with the start date computed on the server. The menus are read by `MenuRepository.list()` (`PostgresMenuRepository`, MF-42), which returns `WeeklyMenu[]` with 14 meals each; the web container does not wire it yet. `/planner` (`src/app/(app)/planner/page.tsx`) is a placeholder inside the shell (MF-51) that greets the user; `protected-pages.test.ts` fails for any page without `requireUser()`. The only server actions so far are in `src/app/_session/actions.ts`; the login form uses `useActionState` with a `{ message, attempt }` state (MF-47.2). `Button` was ported in `src/features/auth/components/button.tsx`.

This change starts after MF-43.1 is merged in the same branch, and MF-43.1 is archived first, because this spec relies on `menu-selection`.

## Goals / Non-Goals

**Goals:**
- Choose a menu in one click, with and without JavaScript, and see its Monday.
- The page stays a thin adapter: session, use cases, props (ADR-001 §5).

**Non-Goals:**
- Search, ranking or explanation (MF-22), recipe cards (MF-23), the shopping list (MF-24).
- Pagination or filtering: there are 36 menus.
- A confirmation before replacing next week's choice: replacing is cheap and the summary shows it at once.

## Decisions

### D1. No mock in the design system: a deviation to accept
UI-design-system asks for a mock in claude.ai before a screen is built. This screen is provisional (MF-22 replaces it) and uses only what is already ported: the shell, `Button`, the tokens, and native `<details>`. Making a mock for a screen that will be thrown away costs more than it gives. **Deviation:** if the author does not accept it, the mock is made before `apply` and D3 follows it.

### D2. A use case and a DTO for the list
`listMenus({ menus })` in `src/application/use-cases/list-menus.ts` reads `MenuRepository.list()` and maps each `WeeklyMenu` to `MenuSummaryDto` (`src/application/dto/menu-summary.ts`):
```ts
type MenuSummaryDto = { number: number; days: { day: Day; lunch: string[]; dinner: string[] }[] };
```
with only the dish names: the feature does not need recipe files or marks, and `features/` cannot import `domain/` (ADR-001 §3). It returns `Result<MenuSummaryDto[], { kind: 'failed' }>`. `src/application/dto/selection-summary.ts` declares `SelectionSummaryDto = { menuNumber: number; startsOn: string }` and `CurrentSelectionsDto = { activeMenu: SelectionSummaryDto | null; shoppingList: SelectionSummaryDto | null }`; MF-43.1's domain types are assignable to them, so the page passes the use case result as it comes.

The web container wires `listMenus` with `PostgresMenuRepository` on its existing pool.

### D3. One form for the whole list
The feature `src/features/menu-planner/` renders one `<form action={chooseMenuAction}>` around the list. Each menu is a card with "Menú N", a `<details>` with its dishes by day (Spanish day names; lunch and dinner labelled) and a submit button `<button name="menuNumber" value={N}>Elegir</button>`. One form, so the action is bound once and the state holds one message for the page; it works without JavaScript because it is a plain form post. The chosen menu (`shoppingList.menuNumber`) gets a "Elegido" badge and its button reads "Elegido" while staying usable.

Above the list, `SelectionSummary` shows "Esta semana" and "La semana que viene", each "Menú N · desde el lunes 5 de octubre" or "Sin elegir". The message of the last action sits under it in a `role="status"` region (or `role="alert"` for a failure), with the `attempt` counter of MF-47.2 so a repeated message is announced again.

`Button` moves to `src/shared/ui/button.tsx`, with its test, because a second feature now uses it (Scope Rule); `features/auth` imports it from there.

### D4. The server action checks the session first
`src/app/(app)/planner/actions.ts`:
```ts
export async function chooseMenuAction(previous: PlannerFormState, form: FormData): Promise<PlannerFormState> {
  const user = await requireUser();            // redirects to /login without a valid session
  const result = await webContainer().selectMenu({ userId: user.userId, menuNumber: form.get('menuNumber') ?? undefined });
  ...
  revalidatePath('/planner');
}
```
`requireUser()` is the first line, before the form is read. Only `menuNumber` is read from the form, so an extra field naming another user changes nothing. Messages: success "Menú 12 elegido: empieza el lunes 5 de octubre."; `invalid-menu` and `unknown-menu` share "No se ha podido elegir ese menú." (the posted value is never echoed); `failed` gives "No se ha podido guardar la elección. Inténtalo de nuevo.". `protected-pages.test.ts` is extended to fail for an `actions.ts` under `(app)/` whose exported functions do not call `requireUser()` first.

### D5. Spanish dates without the comma
`Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })` writes "lunes, 5 de octubre". The feature builds "lunes 5 de octubre" from `formatToParts`, in `src/features/menu-planner/format-monday.ts`, reading the `LocalDate` string as a UTC date, so the server's zone never shifts the day.

### D6. End-to-end test with fictitious menus
`e2e/planner.spec.ts` inserts two fictitious menus (numbers 9001 and 9002, with made-up dish names; never real data, `AGENTS.md`) with their 14 meals into the test database before the run, and deletes them and the test account's selections after it (MF-49: no test data left behind). It signs in with the e2e account, opens `/planner`, chooses 9001 and checks the message and the summary; then repeats with JavaScript disabled for 9002. The date in the message depends on the day of the run, so the test computes the expected Monday with the same rule. The negative scenarios ("Choosing without a session", "A user id in the request is ignored", "A tampered menu number") are covered in the action's unit test with the web container mocked, and "Choosing without a session" also end-to-end, posting to the action without a cookie.

## Risks / Trade-offs

- [The menus' dish names reach the browser] → only for a signed-in user, inside the page's HTML; they are catalogue data, already cleaned of the nutritionist's brand by the ingestion.
- [One form for 36 buttons] → a submit carries only the button pressed; accepted.
- [No mock] → D1, a deviation the author accepts or not before `apply`.
- [The e2e test depends on the day of the run] → the expected Monday is computed, not hard-coded.
