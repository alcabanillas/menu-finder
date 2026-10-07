import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const recipe = (file: string): Recipe => ({
  file,
  sourceMenu: 1,
  title: file,
  times: { total: null, preparation: null, cooking: null, resting: null },
  ingredients: [],
  preparation: ['Paso.'],
});

const dish = (position: number, name: string, recipeFile: string | null): MenuDish => ({
  position,
  name,
  hasRecipeMark: recipeFile !== null,
  recipeFile,
});

const menu = (number: number, lunch: MenuDish[], dinner: MenuDish[] = []): WeeklyMenu => ({
  number,
  meals: [
    { day: 'monday', type: 'lunch', dishes: lunch },
    { day: 'monday', type: 'dinner', dishes: dinner },
  ],
});

// Creating and migrating a database of its own is network to Neon, slower than the default 5 s on the CI runner (MF-49).
const OWN_DATABASE_TIMEOUT_MS = 30_000;

describe.skipIf(!TEST_DATABASE_URL)('PostgresMenuRepository (Neon test branch)', () => {
  let db: TestDatabase;
  let menus: PostgresMenuRepository;
  // One database for the file. A test that alters its schema needs a database of its own (`brokenDatabase`), or the
  // tests after it would find a table missing.
  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    menus = new PostgresMenuRepository(db.pool);
  });
  beforeEach(async () => {
    await db.truncate();
    await new PostgresRecipeRepository(db.pool).saveAll([recipe('Tortilla'), recipe('Crema')]);
  });
  afterAll(async () => {
    await db.drop();
  });

  const dishes = async () =>
    (
      await db.pool.query(
        `SELECT menu_number, day, type, position, name, has_recipe_mark, recipe_key
         FROM menu_dish ORDER BY menu_number, day, type, position`,
      )
    ).rows;
  const menuNumbers = async () => (await db.pool.query('SELECT number FROM menu ORDER BY number')).rows;
  // Read with SQL: `ShoppingListRepository` has no read method yet, and none is added for a test (design D2).
  const shoppingItems = async () =>
    (await db.pool.query('SELECT * FROM shopping_item ORDER BY menu_number, position')).rows;

  async function brokenDatabase(): Promise<TestDatabase> {
    const own = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    try {
      await new PostgresRecipeRepository(own.pool).saveAll([recipe('Tortilla'), recipe('Crema')]);
    } catch (error) {
      await own.drop();
      throw error;
    }
    return own;
  }

  it('stores each menu with its meals and its dishes in their positions', async () => {
    const result = await menus.saveAll([
      menu(1, [dish(1, 'Tortilla de patata', 'Tortilla'), dish(2, 'Fruta', null)], [dish(1, 'Crema', 'Crema')]),
    ]);

    expect(result).toEqual({ ok: true, value: undefined });
    expect((await db.pool.query('SELECT menu_number, day, type FROM meal ORDER BY type')).rows).toEqual([
      { menu_number: 1, day: 'monday', type: 'dinner' },
      { menu_number: 1, day: 'monday', type: 'lunch' },
    ]);
    expect(await dishes()).toEqual([
      { menu_number: 1, day: 'monday', type: 'dinner', position: 1, name: 'Crema', has_recipe_mark: true, recipe_key: 'Crema' },
      { menu_number: 1, day: 'monday', type: 'lunch', position: 1, name: 'Tortilla de patata', has_recipe_mark: true, recipe_key: 'Tortilla' },
      { menu_number: 1, day: 'monday', type: 'lunch', position: 2, name: 'Fruta', has_recipe_mark: false, recipe_key: 'dish:Fruta' },
    ]);
  });

  it('makes one name-only recipe row per dish name without recipe file', async () => {
    await menus.saveAll([menu(1, [dish(1, 'Fruta', null)], [dish(1, 'Fruta', null)]), menu(2, [dish(1, 'Fruta', null)])]);

    expect(
      (await db.pool.query('SELECT key, file, title, preparation FROM recipe WHERE file IS NULL')).rows,
    ).toEqual([{ key: 'dish:Fruta', file: null, title: 'Fruta', preparation: null }]);
  });

  it('replaces the dishes of a menu saved again and keeps the menus it did not receive', async () => {
    await menus.saveAll([menu(1, [dish(1, 'Tortilla de patata', 'Tortilla')]), menu(2, [dish(1, 'Crema', 'Crema')])]);
    await menus.saveAll([menu(2, [dish(1, 'Tortilla de patata', 'Tortilla')])]);

    expect(await menuNumbers()).toEqual([{ number: 1 }, { number: 2 }]);
    expect((await dishes()).map(({ menu_number, recipe_key }) => [menu_number, recipe_key])).toEqual([
      [1, 'Tortilla'],
      [2, 'Tortilla'],
    ]);
  });

  it('keeps the shopping list of a menu saved again', async () => {
    await menus.saveAll([menu(4, [dish(1, 'Tortilla de patata', 'Tortilla')])]);
    await new PostgresShoppingListRepository(db.pool).saveAll([
      {
        menuNumber: 4,
        items: [
          { category: 'Verduras', name: 'Patata', quantity: 500, unit: 'g', optional: false },
          { category: 'Otros', name: 'Pan', quantity: null, unit: null, optional: true },
        ],
      },
    ]);
    const before = await shoppingItems();

    await menus.saveAll([menu(4, [dish(1, 'Crema', 'Crema')])]);

    expect(before).toHaveLength(2);
    expect(await shoppingItems()).toEqual(before);
  });

  it('leaves only the new dishes of a menu saved again', async () => {
    await menus.saveAll([menu(4, [dish(1, 'Tortilla de patata', 'Tortilla'), dish(2, 'Fruta', null)])]);

    await menus.saveAll([menu(4, [dish(1, 'Crema', 'Crema')])]);

    expect((await dishes()).map(({ menu_number, type, name }) => [menu_number, type, name])).toEqual([
      [4, 'lunch', 'Crema'],
    ]);
  });

  it('does not save a menu whose recipe is not in the database, saves the others and names the dish', async () => {
    const result = await menus.saveAll([
      menu(1, [dish(1, 'Tortilla de patata', 'Tortilla')]),
      menu(2, [dish(1, 'Lentejas estofadas', 'Lentejas')]),
    ]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.reason).toContain('Menu 2, dish "Lentejas estofadas": recipe file Lentejas');
    expect(await menuNumbers()).toEqual([{ number: 1 }]);
  });

  it('stores names with SQL metacharacters and unusual Unicode as they are', async () => {
    const names = ["Robert'); DROP TABLE menu;--", 'Ñoquis "caseros" \\ $1', 'Crème brûlée 🍮​', ''];

    await menus.saveAll([menu(1, names.map((name, i) => dish(i + 1, name, null)))]);

    expect((await dishes()).map(({ name }) => name)).toEqual(names);
    expect(await menuNumbers()).toEqual([{ number: 1 }]);
  });

  it('lists the menus it saved, by number, with the meals in week order and the dishes by position', async () => {
    const second: WeeklyMenu = {
      number: 2,
      meals: [
        { day: 'monday', type: 'lunch', dishes: [dish(1, 'Crema', 'Crema')] },
        { day: 'monday', type: 'dinner', dishes: [] },
        { day: 'sunday', type: 'lunch', dishes: [dish(1, 'Fruta', null)] },
        { day: 'sunday', type: 'dinner', dishes: [dish(1, 'Tortilla de patata', 'Tortilla'), dish(2, 'Pan', null)] },
      ],
    };
    const first = menu(1, [dish(1, 'Tortilla de patata', 'Tortilla'), dish(2, 'Fruta', null)], [dish(1, 'Crema', 'Crema')]);
    await menus.saveAll([second, first]);

    expect(await menus.list()).toEqual({ ok: true, value: [first, second] });
  });

  it('finds one menu by number, with its meals in week order and its dishes by position', async () => {
    const first = menu(1, [dish(1, 'Tortilla de patata', 'Tortilla'), dish(2, 'Fruta', null)], [dish(1, 'Crema', 'Crema')]);
    const second = menu(2, [dish(1, 'Crema', 'Crema')]);
    await menus.saveAll([first, second]);

    expect(await menus.find(1)).toEqual({ ok: true, value: first });
  });

  it('finds no menu for a number not stored', async () => {
    await menus.saveAll([menu(1, [dish(1, 'Crema', 'Crema')])]);

    expect(await menus.find(7)).toEqual({ ok: true, value: null });
  });

  it('lists no menu on an empty database', async () => {
    expect(await menus.list()).toEqual({ ok: true, value: [] });
  });

  it('returns the database error when it cannot list', async () => {
    const own = await brokenDatabase();
    try {
      // Renamed, not dropped: with the table gone, the search path would find the one in `public`.
      await own.pool.query('ALTER TABLE menu_dish RENAME COLUMN position TO place');

      expect(await new PostgresMenuRepository(own.pool).list()).toMatchObject({
        ok: false,
        error: { kind: 'read-failed' },
      });
    } finally {
      await own.drop();
    }
  }, OWN_DATABASE_TIMEOUT_MS);

  it('returns the database error and saves nothing when the save fails half-way', async () => {
    const own = await brokenDatabase();
    try {
      await own.pool.query('DROP TABLE menu_dish');

      const result = await new PostgresMenuRepository(own.pool).saveAll([
        menu(1, [dish(1, 'Tortilla de patata', 'Tortilla')]),
      ]);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.error.reason).toContain('menu_dish');
      expect((await own.pool.query('SELECT number FROM menu')).rows).toEqual([]);
    } finally {
      await own.drop();
    }
  }, OWN_DATABASE_TIMEOUT_MS);
});
