import type pg from 'pg';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import type { RepositoryError } from '@/application/ports/repository-error';
import type { ShoppingList } from '@/domain/shopping/shopping-list';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';
import { asJson, inTransaction } from '@/infrastructure/postgres/transaction';

const INSERT_ITEMS = `
  INSERT INTO shopping_item (menu_number, position, category, name, quantity, unit, optional)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(menu_number int, position int, category text, name text, quantity numeric, unit text, optional boolean)`;

/** The shopping lists in Postgres: shopping items keyed by menu_number and position. */
export class PostgresShoppingListRepository implements ShoppingListRepository {
  constructor(private readonly pool: pg.Pool) {}

  /** Inserts or replaces all shopping items for each list received; other menus are kept. */
  async saveAll(lists: ShoppingList[]): Promise<Result<void, RepositoryError>> {
    if (lists.length === 0) {
      return ok(undefined);
    }

    const items = lists.flatMap(({ menuNumber, items }) =>
      items.map((item, index) => ({
        menu_number: menuNumber,
        position: index + 1,
        category: item.category,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        optional: item.optional,
      })),
    );

    try {
      await inTransaction(this.pool, async (client) => {
        await client.query('DELETE FROM shopping_item WHERE menu_number = ANY($1::int[])', [
          lists.map(({ menuNumber }) => menuNumber),
        ]);
        if (items.length > 0) {
          await client.query(INSERT_ITEMS, [asJson(items)]);
        }
      });
      return ok(undefined);
    } catch (error) {
      return err({ kind: 'write-failed', reason: describeDatabaseError(error) });
    }
  }
}
