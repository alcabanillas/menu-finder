## Why

Roadmap item **MF-24**: `/shopping-list` is still a placeholder ("Aquí verás la lista de la compra"). Its dependencies are done: MF-10 stores each menu's shopping list in `shopping_item`, MF-43 stores the user's selections and says which one gives the current shopping list, and MF-51 gives the shell the page sits in. This change closes the weekly flow of UI-flujo-semanal: the user picks a menu, its list becomes the current list, and the user ticks items off as they shop. The author chose to do it as one change, without splitting it into subtasks (2026-10-07), with tasks that can run in parallel once the ports are fixed.

**Result:** in the browser, `/shopping-list` shows the current list grouped by category, you tick an item, reload, and it is still ticked.

## What Changes

- **`/shopping-list` shows the current shopping list** of the signed-in user: the selection that `currentSelections` (MF-43.1) returns as `shoppingList`, its menu number, and its items grouped by category in the order of the PDF, each with its quantity and unit and the mark "opcional". Without a current list, the page says so and links to `/planner`.
- **Ticking an item** stores it for that selection. A ticked item stays ticked after a reload and on another device. Unticking removes the mark.
- **"Marcar todos" per category** ticks every item of that category, or unticks them all when they are all ticked, as the mock shows.
- **Progress**: "N de M" ticked items, with a progress bar.
- **Filter "Todo" / "Por comprar"**: the second one hides the ticked items. It is a query parameter read on the server, so it works without JavaScript.
- **Ticks belong to the selection, not to the menu** (ARQ-modelo-datos, `UserShoppingItem(selectionId, position, checked)`, decided by the author on 2026-10-07). Choosing the same menu for another week starts with nothing ticked. Replacing a week's menu (MF-43.1 gives the new selection a new identity) drops the ticks of the old one.
- **Ticks survive re-loading the shopping lists**: `pnpm ingest shopping-list` replaces `shopping_item` rows but keeps their positions, and a tick refers to a position, not to a row.
- **Visual source**: `ShoppingScreen.jsx` of the Menu Finder Design System, with its `Checkbox`, `ProgressBar` and `SectionHeader` components ported to TypeScript (UI-design-system).
- **Left out:** ticking items of a past or future list other than the current one; editing the list (it is primary data and never recalculated, ING-lista-dato-primario); adding items by hand; sharing the list between users; the dashboard's progress card (MF-25).

## Capabilities

### New Capabilities
- `shopping-checklist`: what `/shopping-list` shows, how a signed-in user ticks and unticks items of the current shopping list, what happens to the ticks when the selection or the lists change, and its negative cases.

### Modified Capabilities
- None. `menu-selection` already defines the current shopping list, and this change reads it without changing it. `shopping-list-ingestion` keeps its behaviour; the new scenario about ticks surviving a reload belongs to `shopping-checklist`.

## Impact

- **Code:** a migration `postgres/migrations/006-user-shopping-item.sql`; new read and write methods on the existing ports `ShoppingListRepository` and `SelectionRepository` and their Postgres adapters; pure grouping and progress rules in `src/domain/shopping/`; use cases `shoppingChecklist` and `checkShoppingItems`; a DTO for the page; a feature `src/features/shopping-list/` (the checklist, the row, the category header, the progress bar, the filter); `src/app/(app)/shopping-list/page.tsx` and a new `actions.ts`; `web-container.ts` wires both use cases; `e2e/shopping-list.spec.ts`.
- **Dependencies:** none new.
- **Decisions relied on:** UI-flujo-semanal, ARQ-modelo-datos (`UserShoppingItem`), ING-lista-compra and ING-lista-dato-primario, UI-design-system, ARQ-hexagonal and `context/adr/ADR-001-arquitectura-interna.md` §2, §3, §4 and §5, SEG-roles, SEG-sistema-cerrado; `context/safety-first.md` §2.2. No contradiction found.
- **Data:** the user's own ticks and the shopping list of their current selection. Item names and quantities are the nutritionist's list (SEG-datos-nutricionista allows them in the database and on the page of a signed-in user); they are never logged. The tests use fictitious menus and items created by the test itself.
- **Abuses and OWASP:**
  - Ticking without a session (A01, A07): the server action is a public POST endpoint, so it checks the session first; without one it stores nothing and goes to `/login`.
  - Ticking another user's list (A01, IDOR): the form never names a user or a selection; the server takes the user from the session and the selection from that user's current list. Fields naming them are ignored.
  - Ticking a position that does not exist, or that belongs to another menu (A04): the positions are validated against the items of the current list; anything else is refused and nothing is stored.
  - Ticking a list that stopped being current while the page was open (A04): the form carries the menu number it was drawn for; if it is no longer the current list's, nothing is stored and the page asks to reload.
  - Malformed input (A03, A04): positions must be positive integers, at most as many as the list has items; the tick value must be `true` or `false`. Queries are parameterised.
  - Cross-site request forgery (A01): Next.js server actions accept only POST and check the `Origin`; nothing here weakens it.
  - Reading another user's ticks: every query of the adapter joins on the selection's `user_id`, since there are no RLS policies yet (MF-48).
