## Why

Roadmap item **MF-52** (`context/roadmap.md`). `shopping_item.menu_number` references `menu (number) ON DELETE CASCADE` (`postgres/migrations/004-shopping-list.sql`), and the menu save replaces each menu by deleting its `menu` row and inserting it again. So `pnpm ingest menu` run after `pnpm ingest shopping-list` silently deletes the shopping list of every reloaded menu. The same would happen to any future table that references `menu`, such as the `selection` table of MF-43.1. This has to be fixed before MF-24 builds the shopping list screen on these rows.

## What Changes

- Saving a menu keeps its `menu` row and replaces only its meals and dishes. A menu number that is not stored yet is inserted; one that is stored stays as it is.
- Rows in other tables that point to a reloaded menu, such as its shopping items, are kept.
- No migration: the foreign keys stay as they are. The author chose this over a deferred foreign key on `shopping_item` (the MF-43.1 D3 pattern). See `design.md` D1.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `search-index`: the requirement "Database content" adds that replacing a menu keeps the rows of other tables that point to it.

## Impact

- Code: `src/infrastructure/postgres/postgres-menu-repository.ts` (the private `write` method) and its integration test. No port, use case or CLI command changes; `MenuRepository.saveAll` keeps its contract.
- Data touched: the `menu`, `meal` and `menu_dish` tables on write; `shopping_item` is only read by the new test. The tests use fictitious fixtures, never nutritionist data (SEG-datos-nutricionista).
- Security: no new input, endpoint or command, so there is no new abuse surface. The bug is a loss of data integrity caused by the design of the write (OWASP A04 Insecure Design); the fix closes it for every table that references `menu`.
- Decisions relied on: ING-lista-compra and ARQ-modelo-datos (`context/decisiones.md`). It contradicts none.
- MF-43.1 (`openspec/changes/mf-43-1-menu-selection/design.md` D3, not merged yet) chose a deferred foreign key on `selection` because the menus were deleted and reinserted. With this change that is no longer needed; whether to simplify it is decided in that change.
