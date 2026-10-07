import type pg from 'pg';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import type { Day, Meal, MealType, MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { missingRecipes, recipeKeyOf, type MissingRecipe } from '@/domain/menu/dish-recipe';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';
import { asJson, inTransaction } from '@/infrastructure/postgres/transaction';

const INSERT_NAME_ONLY_RECIPES = `
  INSERT INTO recipe (key, title) SELECT key, title FROM jsonb_to_recordset($1::jsonb) AS r(key text, title text)
  ON CONFLICT (key) DO NOTHING`;

// A stored menu keeps its row, so the rows that point to it (its shopping list) survive a reload (MF-52 design D1).
const INSERT_MENUS = `
  INSERT INTO menu (number) SELECT number FROM jsonb_to_recordset($1::jsonb) AS r(number int)
  ON CONFLICT (number) DO NOTHING`;

const INSERT_MEALS = `
  INSERT INTO meal (menu_number, day, type)
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(menu_number int, day text, type text)`;

const INSERT_DISHES = `
  INSERT INTO menu_dish (menu_number, day, type, position, name, has_recipe_mark, recipe_key)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(menu_number int, day text, type text, position int, name text, has_recipe_mark boolean, recipe_key text)`;

// Every meal, with its dishes if it has any, in the order of `WeeklyMenu`: week days, lunch before dinner, positions.
const SELECT_MEALS = `
  SELECT m.menu_number, m.day, m.type, d.position, d.name, d.has_recipe_mark, r.file
  FROM meal m
  LEFT JOIN menu_dish d ON (d.menu_number, d.day, d.type) = (m.menu_number, m.day, m.type)
  LEFT JOIN recipe r ON r.key = d.recipe_key`;
const ORDER_MEALS = 'ORDER BY m.menu_number, array_position($1::text[], m.day), array_position($2::text[], m.type), d.position';
const SELECT_MENUS = `${SELECT_MEALS} ${ORDER_MEALS}`;
const SELECT_MENU = `${SELECT_MEALS} WHERE m.menu_number = $3 ${ORDER_MEALS}`;

const WEEK_DAYS: Day[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MEAL_TYPES: MealType[] = ['lunch', 'dinner'];

/** A meal row and, when the meal has dishes, one of them; the dish columns are all null for a meal with none. */
type MenuRow = {
  menu_number: number;
  day: Day;
  type: MealType;
  position: number | null;
  name: string | null;
  has_recipe_mark: boolean | null;
  file: string | null;
};

/** The menus in Postgres: menu → meal → dish, each dish pointing to its recipe row. */
export class PostgresMenuRepository implements MenuRepository {
  constructor(private readonly pool: pg.Pool) {}

  async list(): Promise<Result<WeeklyMenu[], RepositoryReadError>> {
    try {
      const { rows } = await this.pool.query<MenuRow>(SELECT_MENUS, [WEEK_DAYS, MEAL_TYPES]);
      return ok(toWeeklyMenus(rows));
    } catch (error) {
      return err({ kind: 'read-failed', reason: describeDatabaseError(error) });
    }
  }

  async find(number: number): Promise<Result<WeeklyMenu | null, RepositoryReadError>> {
    try {
      const { rows } = await this.pool.query<MenuRow>(SELECT_MENU, [WEEK_DAYS, MEAL_TYPES, number]);
      return ok(toWeeklyMenus(rows)[0] ?? null);
    } catch (error) {
      return err({ kind: 'read-failed', reason: describeDatabaseError(error) });
    }
  }

  /**
   * Replaces each menu it receives and keeps the others. A menu with a dish
   * whose recipe file is not in the database is not saved; the rest are, and
   * the error names every such dish (MF-41 design D9).
   */
  async saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>> {
    const files = menus.flatMap(({ meals }) => meals.flatMap(({ dishes }) => dishes.map((dish) => dish.recipeFile)));

    try {
      const missing = await inTransaction(this.pool, async (client) => {
        const { rows } = await client.query<{ file: string }>('SELECT file FROM recipe WHERE file = ANY($1::text[])', [
          files.filter((file) => file !== null),
        ]);
        const missing = missingRecipes(menus, new Set(rows.map(({ file }) => file)));
        const incomplete = new Set(missing.map(({ menu }) => menu));
        await this.write(
          client,
          menus.filter(({ number }) => !incomplete.has(number)),
        );
        return missing;
      });
      return missing.length === 0 ? ok(undefined) : err({ kind: 'write-failed', reason: missing.map(describeMissing).join('; ') });
    } catch (error) {
      return err({ kind: 'write-failed', reason: describeDatabaseError(error) });
    }
  }

  private async write(client: pg.PoolClient, menus: WeeklyMenu[]): Promise<void> {
    const meals = menus.flatMap(({ number, meals }) => meals.map((meal) => ({ menu_number: number, ...meal })));
    const dishes = meals.flatMap(({ menu_number, day, type, dishes }) =>
      dishes.map((dish) => ({
        menu_number,
        day,
        type,
        position: dish.position,
        name: dish.name,
        has_recipe_mark: dish.hasRecipeMark,
        recipe_key: recipeKeyOf(dish),
      })),
    );
    const nameOnly = new Map(
      meals.flatMap(({ dishes }) =>
        dishes.filter((dish) => dish.recipeFile === null).map((dish) => [recipeKeyOf(dish), dish.name] as const),
      ),
    );

    await client.query(INSERT_NAME_ONLY_RECIPES, [asJson([...nameOnly].map(([key, title]) => ({ key, title })))]);
    // The menu row stays; dishes go with their meals (`ON DELETE CASCADE`).
    await client.query(INSERT_MENUS, [asJson(menus.map(({ number }) => ({ number })))]);
    await client.query('DELETE FROM meal WHERE menu_number = ANY($1::int[])', [menus.map(({ number }) => number)]);
    await client.query(INSERT_MEALS, [asJson(meals.map(({ menu_number, day, type }) => ({ menu_number, day, type })))]);
    await client.query(INSERT_DISHES, [asJson(dishes)]);
  }
}

// The rows come ordered, so the menus, meals and dishes keep that order.
function toWeeklyMenus(rows: MenuRow[]): WeeklyMenu[] {
  const menus = new Map<number, WeeklyMenu>();
  const meals = new Map<string, Meal>();
  for (const row of rows) {
    const menu = menus.get(row.menu_number) ?? addMenu(menus, row.menu_number);
    const mealKey = `${row.menu_number}/${row.day}/${row.type}`;
    const meal = meals.get(mealKey) ?? addMeal(meals, mealKey, menu, row);
    if (row.position !== null) meal.dishes.push(toMenuDish(row));
  }
  return [...menus.values()];
}

function addMenu(menus: Map<number, WeeklyMenu>, number: number): WeeklyMenu {
  const menu: WeeklyMenu = { number, meals: [] };
  menus.set(number, menu);
  return menu;
}

function addMeal(meals: Map<string, Meal>, key: string, menu: WeeklyMenu, { day, type }: MenuRow): Meal {
  const meal: Meal = { day, type, dishes: [] };
  meals.set(key, meal);
  menu.meals.push(meal);
  return meal;
}

// A row with a position has every dish column; `file` is null for a dish without recipe file.
function toMenuDish({ position, name, has_recipe_mark, file }: MenuRow): MenuDish {
  return { position: position!, name: name!, hasRecipeMark: has_recipe_mark!, recipeFile: file };
}

function describeMissing({ menu, dish, file }: MissingRecipe): string {
  return `Menu ${menu}, dish "${dish}": recipe file ${file} is not in the database (run \`pnpm ingest recipes\` first)`;
}
