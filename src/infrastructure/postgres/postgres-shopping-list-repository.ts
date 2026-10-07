import type pg from 'pg';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import type { ShoppingList, StoredShoppingItem } from '@/domain/shopping/shopping-list';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';
import { asJson, inTransaction } from '@/infrastructure/postgres/transaction';

const INSERT_ITEMS = `
  INSERT INTO shopping_item (menu_number, position, category, name, quantity, unit, optional)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(menu_number int, position int, category text, name text, quantity numeric, unit text, optional boolean)`;

// `quantity::float8` makes `pg` return a number: it returns a string for `numeric`.
const FIND_ITEMS = `
  SELECT position, category, name, quantity::float8 AS quantity, unit, optional
  FROM shopping_item
  WHERE menu_number = $1
  ORDER BY position`;

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

  /** The items of the menu's list ordered by position; empty when the menu has no stored list. */
  async find(menuNumber: number): Promise<Result<StoredShoppingItem[], RepositoryReadError>> {
    try {
      const { rows } = await this.pool.query<StoredShoppingItem>(FIND_ITEMS, [menuNumber]);
      return ok(rows);
    } catch (error) {
      return err({ kind: 'read-failed', reason: describeDatabaseError(error) });
    }
  }
}
