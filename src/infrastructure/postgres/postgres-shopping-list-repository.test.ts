import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ShoppingList } from '@/domain/shopping/shopping-list';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const list4: ShoppingList = {
  menuNumber: 4,
  items: [
    {
      category: 'Cárnicos y derivados',
      name: 'Pollo (pechuga)',
      quantity: 240,
      unit: 'g',
      optional: false,
    },
    {
      category: 'Especias',
      name: 'Curry',
      quantity: null,
      unit: null,
      optional: false,
    },
  ],
};

const list5: ShoppingList = {
  menuNumber: 5,
  items: [
    {
      category: 'Huevos y derivados',
      name: 'Huevo de gallina fresco',
      quantity: 3,
      unit: null,
      optional: false,
    },
  ],
};

describe.skipIf(!TEST_DATABASE_URL)('PostgresShoppingListRepository (Neon test branch)', () => {
  let db: TestDatabase;
  let repository: PostgresShoppingListRepository;

  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    repository = new PostgresShoppingListRepository(db.pool);
  });

  beforeEach(async () => {
    await db.truncate();
    await db.pool.query('INSERT INTO menu (number) VALUES (4), (5)');
  });

  afterAll(async () => {
    await db.drop();
  });

  const stored = async () => {
    const { rows } = await db.pool.query<{
      menu_number: number;
      position: number;
      category: string;
      name: string;
      quantity: number | null;
      unit: string | null;
      optional: boolean;
    }>(
      `SELECT menu_number, position, category, name, quantity::float AS quantity, unit, optional
       FROM shopping_item
       ORDER BY menu_number, position`,
    );
    return rows;
  };

  it('Rerun gives the same rows', async () => {
    expect(await repository.saveAll([list4])).toEqual({ ok: true, value: undefined });
    expect(await repository.saveAll([list4])).toEqual({ ok: true, value: undefined });

    const rows = await stored();
    expect(rows).toEqual([
      {
        menu_number: 4,
        position: 1,
        category: 'Cárnicos y derivados',
        name: 'Pollo (pechuga)',
        quantity: 240,
        unit: 'g',
        optional: false,
      },
      {
        menu_number: 4,
        position: 2,
        category: 'Especias',
        name: 'Curry',
        quantity: null,
        unit: null,
        optional: false,
      },
    ]);
  });

  it('Other menus kept', async () => {
    await repository.saveAll([list4, list5]);
    await repository.saveAll([
      {
        menuNumber: 5,
        items: [
          {
            category: 'Lácteos y derivados',
            name: 'Yogur natural',
            quantity: 125,
            unit: 'g',
            optional: true,
          },
        ],
      },
    ]);

    const rows = await stored();
    expect(rows.map((r) => r.menu_number)).toEqual([4, 4, 5]);
    expect(rows.filter((r) => r.menu_number === 4)).toHaveLength(2);
    expect(rows.find((r) => r.menu_number === 5)?.name).toBe('Yogur natural');
  });

  it('Menu not ingested yet', async () => {
    const list7: ShoppingList = {
      menuNumber: 7,
      items: [
        {
          category: 'Frutas y derivados',
          name: 'Manzana',
          quantity: 1,
          unit: null,
          optional: false,
        },
      ],
    };

    const result = await repository.saveAll([list7]);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('write-failed');
      expect(result.error.reason).toContain('Menu 7 is not in the database');
      expect(result.error.reason).toContain('run `pnpm ingest menu` first');
    }
    const rows = await stored();
    expect(rows).toEqual([]);
  });

  it('find returns the items of the menu ordered by position, with quantity as a number', async () => {
    await repository.saveAll([list4, list5]);

    const result = await repository.find(4);

    expect(result).toEqual({
      ok: true,
      value: [
        { position: 1, category: 'Cárnicos y derivados', name: 'Pollo (pechuga)', quantity: 240, unit: 'g', optional: false },
        { position: 2, category: 'Especias', name: 'Curry', quantity: null, unit: null, optional: false },
      ],
    });
  });

  it('find gives an empty list for a menu without a stored list', async () => {
    await repository.saveAll([list5]);

    expect(await repository.find(4)).toEqual({ ok: true, value: [] });
  });

  it('find reports read-failed when the table is missing', async () => {
    const own = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    try {
      // A table without the columns in the own schema keeps the query from falling through to `public`.
      await own.pool.query('DROP TABLE shopping_item');
      await own.pool.query('CREATE TABLE shopping_item (id uuid)');

      const result = await new PostgresShoppingListRepository(own.pool).find(4);

      expect(!result.ok && result.error.kind).toBe('read-failed');
    } finally {
      await own.drop();
    }
  }, 30_000);

  it('Names are data, never SQL', async () => {
    const maliciousList: ShoppingList = {
      menuNumber: 4,
      items: [
        {
          category: "Other' --",
          name: "'; DROP TABLE shopping_item; --",
          quantity: 100,
          unit: 'g',
          optional: false,
        },
      ],
    };

    expect(await repository.saveAll([maliciousList])).toEqual({ ok: true, value: undefined });

    const rows = await stored();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("'; DROP TABLE shopping_item; --");
    expect(rows[0].category).toBe("Other' --");

    const checkTable = await db.pool.query(
      "SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'shopping_item'",
      [db.schema],
    );
    expect(checkTable.rowCount).toBe(1);
  });
});
