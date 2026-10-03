import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
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

describe.skipIf(!TEST_DATABASE_URL)('PostgresMenuRepository (Neon test branch)', () => {
  let db: TestDatabase;
  let menus: PostgresMenuRepository;
  beforeEach(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    await new PostgresRecipeRepository(db.pool).saveAll([recipe('Tortilla'), recipe('Crema')]);
    menus = new PostgresMenuRepository(db.pool);
  });
  afterEach(async () => {
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

  it('returns the database error and saves nothing when the save fails half-way', async () => {
    await db.pool.query('DROP TABLE menu_dish');

    const result = await menus.saveAll([menu(1, [dish(1, 'Tortilla de patata', 'Tortilla')])]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.reason).toContain('menu_dish');
    expect(await menuNumbers()).toEqual([]);
  });
});
