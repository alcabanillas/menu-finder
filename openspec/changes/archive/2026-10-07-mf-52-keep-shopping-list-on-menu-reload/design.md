## Context

`PostgresMenuRepository.write` (`src/infrastructure/postgres/postgres-menu-repository.ts`) runs inside the `saveAll` transaction: it inserts the name-only recipes, runs `DELETE FROM menu WHERE number = ANY(...)`, and inserts menus, meals and dishes again. `meal` and `menu_dish` hang from `menu` with `ON DELETE CASCADE` (`001-search-schema.sql`), and so does `shopping_item` (`004-shopping-list.sql`). The `menu` table has only one column, `number`, which is its primary key.

## Goals / Non-Goals

**Goals:**
- A menu save never deletes a `menu` row, so no table that references `menu` loses rows when a menu is reloaded.

**Non-Goals:**
- Changing the foreign keys of `004-shopping-list.sql`. A menu deleted by hand still takes its shopping list with it; no code path deletes menus.
- Changing MF-43.1 D3; that change decides whether its deferred key is still needed.

## Decisions

### D1. Keep the menu row, replace its meals
`write` inserts the menus with `ON CONFLICT (number) DO NOTHING` and deletes the meals of the received menus (`DELETE FROM meal WHERE menu_number = ANY(...)`); their dishes go with them through the `menu_dish` cascade. Then it inserts meals and dishes as today.

`DO NOTHING` and not `DO UPDATE`: `menu` has no column besides its key, so there is nothing to update, and `DO UPDATE` would write a new row version for no change. If `menu` gains columns, this becomes `DO UPDATE` on those columns.

Alternative chosen against by the author: a new migration that re-adds `shopping_item`'s foreign key as `DEFERRABLE INITIALLY DEFERRED` without cascade (MF-43.1 D3). It protects only the table that declares it: every future table that references `menu` must remember the same key, or the bug comes back. It also needs a migration, whose number would collide with MF-43.1's.

### D2. The test reads `shopping_item` with SQL
The test saves the shopping list through `PostgresShoppingListRepository.saveAll`, as the ingestion does, and counts the rows with a direct query. No read method is added to `ShoppingListRepository` for a test: MF-24 will design the read the app needs.

## Risks / Trade-offs

- [A menu whose number disappears from the data stays in the database] → same as today: `saveAll` never removes menus it did not receive (requirement "Database content").
- [The cascade of `004-shopping-list.sql` stays as a trap for a manual `DELETE FROM menu`] → accepted: deleting a menu should take its list with it; the bug was the code deleting menus to replace them.
