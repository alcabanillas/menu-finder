import type pg from "pg";
import type {
  EmbeddingSource,
  IndexContent,
  IndexError,
  SearchIndexWriter,
} from "@/application/ports/search-index-writer";
import { err, ok, type Result } from "@/shared/result";
import { describeDatabaseError } from "@/infrastructure/postgres/describe-database-error";

// Every value goes in as one JSON parameter per table and is expanded by `jsonb_to_recordset`:
// one round trip per table, and nothing from the dataset is ever part of the SQL text.
const INSERT_MENUS = `INSERT INTO menu (number) SELECT number FROM jsonb_to_recordset($1::jsonb) AS r(number int)`;

const INSERT_MEALS = `
  INSERT INTO meal (menu_number, day, type)
  SELECT menu_number, day, type FROM jsonb_to_recordset($1::jsonb) AS r(menu_number int, day text, type text)`;

const INSERT_DISHES = `
  INSERT INTO menu_dish (menu_number, day, type, position, name, has_recipe_mark, recipe_key)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(menu_number int, day text, type text, position int, name text, has_recipe_mark boolean, recipe_key text)`;

const UPSERT_RECIPES = `
  INSERT INTO recipe (key, file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(key text, file text, source_menu int, title text, total_min int, preparation_min int,
         cooking_min int, resting_min int, preparation text[])
  ON CONFLICT (key) DO UPDATE SET
    file = EXCLUDED.file, source_menu = EXCLUDED.source_menu, title = EXCLUDED.title,
    total_min = EXCLUDED.total_min, preparation_min = EXCLUDED.preparation_min,
    cooking_min = EXCLUDED.cooking_min, resting_min = EXCLUDED.resting_min, preparation = EXCLUDED.preparation`;

const INSERT_INGREDIENTS = `
  INSERT INTO recipe_ingredient (recipe_key, position, name, household_measure, quantity, unit, optional)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(recipe_key text, position int, name text, household_measure text, quantity numeric, unit text, optional boolean)`;

const UPSERT_EMBEDDINGS = `
  INSERT INTO recipe_embedding (recipe_key, variant, model, dimensions, source, embedding)
  SELECT recipe_key, $2, model, dimensions, source, embedding::vector FROM jsonb_to_recordset($1::jsonb)
    AS r(recipe_key text, model text, dimensions int, source text, embedding text)
  ON CONFLICT (recipe_key, variant) DO UPDATE SET
    model = EXCLUDED.model, dimensions = EXCLUDED.dimensions, source = EXCLUDED.source, embedding = EXCLUDED.embedding`;

const json = (rows: unknown[]) => JSON.stringify(rows);

const failure = (error: unknown): Result<never, IndexError> =>
  err({ kind: "index-failed", reason: describeDatabaseError(error) });

/** Write side of the search index on Postgres: the whole load in one transaction. */
export class PostgresSearchIndexWriter implements SearchIndexWriter {
  constructor(private readonly pool: pg.Pool) {}

  async embeddingSources(variant: string): Promise<Result<EmbeddingSource[], IndexError>> {
    try {
      const { rows } = await this.pool.query<EmbeddingSource>(
        `SELECT recipe_key AS "recipeKey", model, source FROM recipe_embedding WHERE variant = $1`,
        [variant],
      );
      return ok(rows);
    } catch (error) {
      return failure(error);
    }
  }

  async replace({ dataset, embeddings }: IndexContent): Promise<Result<void, IndexError>> {
    const meals = dataset.menus.flatMap((menu) => menu.meals.map((meal) => ({ menu: menu.number, ...meal })));
    const dishes = meals.flatMap(({ menu, day, type, dishes }) =>
      dishes.map((dish) => ({
        menu_number: menu,
        day,
        type,
        position: dish.position,
        name: dish.name,
        has_recipe_mark: dish.hasRecipeMark,
        recipe_key: dish.recipeKey,
      })),
    );
    const recipes = dataset.recipes.map((recipe) => ({
      key: recipe.key,
      file: recipe.file,
      source_menu: recipe.sourceMenu,
      title: recipe.title,
      total_min: recipe.times?.total ?? null,
      preparation_min: recipe.times?.preparation ?? null,
      cooking_min: recipe.times?.cooking ?? null,
      resting_min: recipe.times?.resting ?? null,
      preparation: recipe.preparation,
    }));
    const ingredients = dataset.recipes.flatMap((recipe) =>
      recipe.ingredients.map((ingredient, i) => ({
        recipe_key: recipe.key,
        position: i + 1,
        name: ingredient.name,
        household_measure: ingredient.householdMeasure,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        optional: ingredient.optional,
      })),
    );
    const added = embeddings.add.map(({ recipeKey, model, dimensions, source, vector }) => ({
      recipe_key: recipeKey,
      model,
      dimensions,
      source,
      embedding: `[${vector.join(",")}]`,
    }));

    let client: pg.PoolClient | undefined;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      // Menus, meals and dishes are rewritten whole; recipes are upserted so that kept embeddings survive.
      await client.query("DELETE FROM menu");
      await client.query("DELETE FROM recipe_ingredient");
      await client.query(UPSERT_RECIPES, [json(recipes)]);
      await client.query("DELETE FROM recipe WHERE NOT (key = ANY($1::text[]))", [recipes.map((r) => r.key)]);
      await client.query("DELETE FROM recipe_embedding WHERE variant = $1 AND NOT (recipe_key = ANY($2::text[]))", [
        embeddings.variant,
        embeddings.keep,
      ]);
      await client.query(UPSERT_EMBEDDINGS, [json(added), embeddings.variant]);
      await client.query(INSERT_INGREDIENTS, [json(ingredients)]);
      await client.query(INSERT_MENUS, [json(dataset.menus.map((menu) => ({ number: menu.number })))]);
      await client.query(INSERT_MEALS, [json(meals.map(({ menu, day, type }) => ({ menu_number: menu, day, type })))]);
      await client.query(INSERT_DISHES, [json(dishes)]);
      await client.query("COMMIT");
      return ok(undefined);
    } catch (error) {
      await client?.query("ROLLBACK").catch(() => undefined);
      return failure(error);
    } finally {
      client?.release();
    }
  }
}
