import type pg from "pg";
import type { MenuRepository, RepositoryError } from "@/application/ports/menu-repository";
import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import { missingRecipes, recipeKeyOf, type MissingRecipe } from "@/domain/menu/dish-recipe";
import { err, ok, type Result } from "@/shared/result";
import { describeDatabaseError } from "@/infrastructure/postgres/describe-database-error";
import { asJson, inTransaction } from "@/infrastructure/postgres/transaction";

const INSERT_NAME_ONLY_RECIPES = `
  INSERT INTO recipe (key, title) SELECT key, title FROM jsonb_to_recordset($1::jsonb) AS r(key text, title text)
  ON CONFLICT (key) DO NOTHING`;

const INSERT_MENUS = `INSERT INTO menu (number) SELECT number FROM jsonb_to_recordset($1::jsonb) AS r(number int)`;

const INSERT_MEALS = `
  INSERT INTO meal (menu_number, day, type)
  SELECT * FROM jsonb_to_recordset($1::jsonb) AS r(menu_number int, day text, type text)`;

const INSERT_DISHES = `
  INSERT INTO menu_dish (menu_number, day, type, position, name, has_recipe_mark, recipe_key)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(menu_number int, day text, type text, position int, name text, has_recipe_mark boolean, recipe_key text)`;

const describeMissing = ({ menu, dish, file }: MissingRecipe): string =>
  `Menu ${menu}, dish "${dish}": recipe file ${file} is not in the database (run \`pnpm ingest recipes\` first)`;

/** The menus in Postgres: menu → meal → dish, each dish pointing to its recipe row. */
export class PostgresMenuRepository implements MenuRepository {
  constructor(private readonly pool: pg.Pool) {}

  /**
   * Replaces each menu it receives and keeps the others. A menu with a dish
   * whose recipe file is not in the database is not saved; the rest are, and
   * the error names every such dish (MF-41 design D9).
   */
  async saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>> {
    const files = menus.flatMap(({ meals }) => meals.flatMap(({ dishes }) => dishes.map((dish) => dish.recipeFile)));

    try {
      const missing = await inTransaction(this.pool, async (client) => {
        const { rows } = await client.query<{ file: string }>("SELECT file FROM recipe WHERE file = ANY($1::text[])", [
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
      return missing.length === 0 ? ok(undefined) : err({ kind: "write-failed", reason: missing.map(describeMissing).join("; ") });
    } catch (error) {
      return err({ kind: "write-failed", reason: describeDatabaseError(error) });
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
    // Meals and dishes go with their menu (`ON DELETE CASCADE`).
    await client.query("DELETE FROM menu WHERE number = ANY($1::int[])", [menus.map(({ number }) => number)]);
    await client.query(INSERT_MENUS, [asJson(menus.map(({ number }) => ({ number })))]);
    await client.query(INSERT_MEALS, [asJson(meals.map(({ menu_number, day, type }) => ({ menu_number, day, type })))]);
    await client.query(INSERT_DISHES, [asJson(dishes)]);
  }
}
