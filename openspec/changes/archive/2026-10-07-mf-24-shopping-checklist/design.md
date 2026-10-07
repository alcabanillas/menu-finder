## Context

- `shopping_item(menu_number, position, category, name, quantity, unit, optional)` holds each menu's list, positions `1..n` in the order of the PDF (MF-10, `postgres/migrations/004-shopping-list.sql`). `pnpm ingest shopping-list` deletes and reinserts a menu's rows; the positions of the same PDF do not change. `ShoppingListRepository` has only `saveAll`.
- `selection(id uuid, user_id, menu_number, selected_at, starts_on)` (MF-43.1, `005-selection.sql`). `SelectionRepository` has `listFrom` and `replace`; `replace` deletes and inserts, so a replaced week gets a new id. `currentSelections` returns `{ activeMenu, shoppingList }`.
- `/shopping-list` is a placeholder inside the shell (MF-51) that already calls `requireUser()`. `protected-pages.test.ts` fails for any page or `(app)/**/actions.ts` without it.
- The visual source is `project/ui_kits/app/ShoppingScreen.jsx` of the Menu Finder Design System (https://claude.ai/artifact/6PMHm2JqbG6LvGKmZXduwF, version `1791390572-4ab7`), with `Checkbox`, `ProgressBar` and `SectionHeader`. The repo's token copy is version `1791096508-606b`.
- ARQ-modelo-datos fixes the model: `UserShoppingItem(selectionId, position, checked)`, hanging from the selection.

## Goals / Non-Goals

**Goals:**
- The page and the tick work against the database, with and without JavaScript, and look like the mock.
- A fixed contract first, then three tracks that touch disjoint files and can run in parallel (the author's instruction, 2026-10-07), then one integration step.

**Non-Goals:**
- Ticking lists other than the current one; editing or adding items; the dashboard's progress (MF-25); RLS policies (MF-48).

## Decisions

### D1. Reuse the two existing ports; no new port

Per the AGENTS.md rule "reuse a port before creating one":
- **Reading the items** is the same data `ShoppingListRepository.saveAll` writes, so it gains `find(menuNumber)`.
- **The ticks** are user data that hangs from a selection and is deleted with it. `SelectionRepository` already owns the user's selections and states that every method works only on that user's rows, which is the filter the ticks need. It gains `checkedPositions` and `setChecked`.

A separate `ShoppingCheckRepository` was considered and rejected: it would be a second port over the same boundary (Postgres) and the same ownership rule, which is the deviation the rule names.

### D2. The contract (phase 1, written before any track starts)

Domain, `src/domain/shopping/shopping-list.ts` (extended) and `src/domain/shopping/checklist.ts` (new):
```ts
export type StoredShoppingItem = ShoppingItem & { position: number };
export type ChecklistItem = StoredShoppingItem & { checked: boolean };
export type ChecklistCategory = { name: string; items: ChecklistItem[]; checkedCount: number };
export type Checklist = { categories: ChecklistCategory[]; checkedCount: number; total: number };
export function toChecklist(items: StoredShoppingItem[], checkedPositions: number[]): Checklist;
```

Ports:
```ts
// ShoppingListRepository
/** The items of the menu's list ordered by position; empty when the menu has no stored list. */
find(menuNumber: number): Promise<Result<StoredShoppingItem[], RepositoryReadError>>;

// SelectionRepository
/** The positions ticked in the user's selection; empty when none, or when the selection is not the user's. */
checkedPositions(userId: string, selectionId: string): Promise<Result<number[], RepositoryReadError>>;
/** Sets the tick of those positions in the user's selection; does nothing when the selection is not the user's. */
setChecked(userId: string, selectionId: string, positions: number[], checked: boolean): Promise<Result<void, RepositoryError>>;
```

DTO, `src/application/dto/shopping-checklist.ts` (what `features/` may import, ADR-001 §3):
```ts
export type ShoppingChecklistItemDto = {
  position: number; name: string; quantity: number | null; unit: string | null; optional: boolean; checked: boolean;
};
export type ShoppingChecklistCategoryDto = { name: string; checkedCount: number; items: ShoppingChecklistItemDto[] };
export type ShoppingChecklistDto = {
  menuNumber: number; startsOn: string; checkedCount: number; total: number; categories: ShoppingChecklistCategoryDto[];
};
```

Use cases, `src/application/use-cases/`:
```ts
// shopping-checklist.ts
type Deps = { selections: SelectionRepository; shoppingLists: ShoppingListRepository; clock: Clock };
export type ShoppingChecklistInput = { userId: string };
export type ShoppingChecklistFailure = { kind: 'failed' };
/** null: the user has no current shopping list. A checklist with total 0: the menu has no stored list. */
export function shoppingChecklist(deps, input): Promise<Result<ShoppingChecklistDto | null, ShoppingChecklistFailure>>;

// check-shopping-items.ts
type Deps = { selections: SelectionRepository; shoppingLists: ShoppingListRepository; clock: Clock };
export type CheckShoppingItemsInput = { userId: string; menuNumber?: unknown; positions?: unknown; checked?: unknown };
export type CheckShoppingItemsFailure = { kind: 'invalid' } | { kind: 'stale' } | { kind: 'failed' };
export function checkShoppingItems(deps, input): Promise<Result<void, CheckShoppingItemsFailure>>;
```

Web container entries: `shoppingChecklist(input)` and `checkShoppingItems(input)`, wired with `PostgresShoppingListRepository` (new in the web container), `PostgresSelectionRepository` and `SystemClock`.

Action, `src/app/(app)/shopping-list/actions.ts`, and its state, declared in the feature (like `RandomMenuState` in MF-43.2):
```ts
export type CheckItemsState = { message: string | null; attempt: number };
export async function checkItemsAction(previous: CheckItemsState, form: FormData): Promise<CheckItemsState>;
```
Form fields: `menuNumber` (one), `position` (one or more, `form.getAll`), `checked` (`"true"` or `"false"`). No other field is read.

Phase 1 writes these types and **skeletons that compile and fail**: `toChecklist` returns an empty checklist, the use cases return `err({ kind: 'failed' })`, the adapter methods return a `read-failed` / `write-failed` error, and the container and the empty `actions.ts` are wired. `unit` is a plain string in the DTO because `features/` cannot import the domain's `Unit`. So `pnpm typecheck` passes from the start, every track sees its RED for real, and no track waits on another to compile. Knip reports the skeleton files and DTO types no page imports yet; that is expected until track C, and phase 4 runs the full `pnpm lint`.

### D3. The three tracks and their files

| Track | Files it owns | Tests | Needs |
|---|---|---|---|
| **A. Core** | `src/domain/shopping/checklist.ts`, `src/application/use-cases/shopping-checklist.ts`, `check-shopping-items.ts` | unit, in-memory repositories and a fixed clock | the contract |
| **B. Infrastructure** | `postgres/migrations/006-user-shopping-item.sql`, `postgres-shopping-list-repository.ts`, `postgres-selection-repository.ts` | integration, test database, one schema per file (MF-50) | the contract |
| **C. Screen** | `src/features/shopping-list/**`, `src/app/(app)/shopping-list/page.tsx`, `actions.ts` | Testing Library with DTO fixtures; page and action with `webContainer` mocked | the contract |

The sets of files are disjoint, so the tracks can run at the same time, by hand or by parallel agents on the same branch. A track touches no file of another; a change to the contract stops the tracks and goes back to phase 1. Phase 4 (integration) starts when the three are green.

### D4. The use cases (track A)

`shoppingChecklist`: `currentSelections` rule (`listFrom(userId, mondayOf(today))` and `currentOf`) → no `shoppingList` gives `ok(null)`; otherwise `find(menuNumber)` and `checkedPositions(userId, selection.id)` (in parallel), `toChecklist`, mapped to the DTO with the selection's `menuNumber` and `startsOn`. Any read error gives `failed`.

`checkShoppingItems`, in this order:
1. Zod: `menuNumber` like `selectMenu`'s schema; `positions` a non-empty array of digit strings or positive integers, at most 200 (no list has that many; it bounds the request); `checked` exactly `"true"`, `"false"`, `true` or `false`. Failure → `invalid`.
2. Current list as in `shoppingChecklist`; none, or its `menuNumber` differs → `stale`.
3. `find(menuNumber)`; any position not among the items' positions → `invalid`.
4. `setChecked(userId, selection.id, uniquePositions, checked)`.
Read or write errors → `failed`. Nothing is written before step 4.

`toChecklist`: categories in order of their first item, items in position order, `checked` from the set of positions, counts per category and in total. Positions ticked that are not in the list are ignored.

### D5. The table (track B)

```sql
CREATE TABLE user_shopping_item (
  selection_id uuid NOT NULL REFERENCES selection (id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  checked boolean NOT NULL,
  PRIMARY KEY (selection_id, position)
);
ALTER TABLE user_shopping_item ENABLE ROW LEVEL SECURITY;
```
- **No key to `shopping_item`**: the reload deletes and reinserts those rows, so a key would cascade and wipe every tick, or block the load. The position is validated by the use case (D4 step 3) instead.
- **CASCADE from `selection`**: replacing a week (new id) and deleting an account drop the ticks, as the spec asks.
- `setChecked` is one `INSERT … SELECT … FROM selection WHERE id = $1 AND user_id = $2 … ON CONFLICT (selection_id, position) DO UPDATE SET checked = EXCLUDED.checked`: the join on `user_id` makes it write nothing for a selection of another user. `checkedPositions` joins `selection` on `user_id` the same way. Unticking stores `checked = false`, keeping the column ARQ-modelo-datos names.
- `find` reads `quantity::float8` so `pg` returns a number, not the string it returns for `numeric`.

### D6. The screen (track C)

Ported from the mock to TypeScript and Tailwind on the app's tokens, each file noting the design system version `1791390572-4ab7`. Under the Scope Rule they stay in `src/features/shopping-list/components/` until a second feature uses them (MF-25 may move `ProgressBar` to `shared/ui/`):
- `ShoppingChecklist` (client): the top bar "Menú N" / "Lista de la compra" and "Desde el lunes 5 de octubre"; `ProgressBar` "Marcados", "N de M"; the view links; one section per category. It keeps the ticks in `useOptimistic`, so a tick shows at once, and one `role="alert"` region for the last failure, keyed by `attempt`.
- `ChecklistRow`: a `<form action>` with hidden `menuNumber`, `position` and `checked` (the new value) and one `<button type="submit" role="checkbox" aria-checked>` holding the box, the name, "opcional" and the amount. A form per row is what makes it work without JavaScript.
- `CategoryToggle`: the same form with every position of the category, `aria-checked` `true`, `false` or `mixed`, the label "Marcar todos: {category}" and "done/total".
- `SectionHeader`, `ProgressBar`: ported as they are.
- `ViewFilter`: two links, `?vista=por-comprar` and `/shopping-list`, with `aria-current` on the active one; styled like the mock's `Chip`. The page reads `searchParams.vista`; any other value is "Todo".
- `format-amount.ts`: `400 g`, `1000 ml`, `2` for a count, nothing when `quantity` is null; numbers with the Spanish decimal comma.
- Empty states: no list ("Aún no has elegido menú." and a link "Elegir menú" to `/planner`); a list with total 0 ("La lista de este menú no está disponible."); a read failure ("No se ha podido cargar la lista. Inténtalo de nuevo.").
- The Monday reuses `formatMonday`, which moves from `src/features/menu-planner/` to `src/shared/format-monday.ts` (a second feature uses it; it is not UI, so it is `shared/`, not `shared/ui/`). This move is done in phase 1, so neither track edits `menu-planner`.

`actions.ts`: `requireUser()` first; then `checkShoppingItems({ userId, menuNumber: form.get('menuNumber'), positions: form.getAll('position'), checked: form.get('checked') })`; on success `revalidatePath('/shopping-list')` and `{ message: null }`. Messages: `invalid` "No se ha podido marcar. Recarga la página."; `stale` "La lista ha cambiado. Recarga la página."; `failed` "No se ha podido guardar. Inténtalo de nuevo.".

### D7. Integration (phase 4)

Wire nothing new (phase 1 did); replace the skeletons' last traces, run the whole suite, and add `e2e/shopping-list.spec.ts`. The e2e test inserts fictitious menu 9101 with three items in two categories and one item without quantity, signs in with a registered test account, chooses the menu through the database (a selection row for this Monday), and removes the selection, items and menu afterwards (MF-49). It ticks, reloads and checks; repeats without JavaScript; ticks a category; uses "Por comprar"; posts without a session; and replaces the selection in the database while the page is open to see the "stale" message.

## Risks / Trade-offs

- [A wrong contract stops the three tracks] → phase 1 is small and reviewed before the tracks start; the skeletons make `typecheck` prove it.
- [A form per row is ~70 forms] → plain HTML, no cost worth measuring; it is what makes the page work without JavaScript.
- [Optimistic tick and server disagree] → `revalidatePath` redraws from the database after each action; a failure shows the alert and the optimistic state is dropped.
- [Two quick taps on the same row race] → the second write wins with the value the user saw last; `ON CONFLICT … DO UPDATE` keeps one row.
- [Ticks keyed by position break if a PDF changes its order] → accepted: the reload of the same PDF keeps positions; a new PDF is a new list (ING-lista-dato-primario).
- [The token copy is older than the design system] → phase 1 compares them and refreshes with `pnpm ds:tokens` if they differ.
