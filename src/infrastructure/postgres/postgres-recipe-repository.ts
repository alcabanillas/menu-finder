import type pg from 'pg';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { Recipe, RecipeIngredient, Unit } from '@/domain/recipe/recipe';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';
import { asJson, inTransaction } from '@/infrastructure/postgres/transaction';

const UPSERT_RECIPES = `
  INSERT INTO recipe (key, file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation)
  SELECT file, file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation
  FROM jsonb_to_recordset($1::jsonb)
    AS r(file text, source_menu int, title text, total_min int, preparation_min int,
         cooking_min int, resting_min int, preparation text[])
  ON CONFLICT (key) DO UPDATE SET
    source_menu = EXCLUDED.source_menu, title = EXCLUDED.title, total_min = EXCLUDED.total_min,
    preparation_min = EXCLUDED.preparation_min, cooking_min = EXCLUDED.cooking_min,
    resting_min = EXCLUDED.resting_min, preparation = EXCLUDED.preparation`;

const INSERT_INGREDIENTS = `
  INSERT INTO recipe_ingredient (recipe_key, position, name, household_measure, quantity, unit, optional)
  SELECT * FROM jsonb_to_recordset($1::jsonb)
    AS r(recipe_key text, position int, name text, household_measure text, quantity numeric, unit text, optional boolean)`;

const SELECT_RECIPES = `
  SELECT file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation
  FROM recipe WHERE file = ANY($1::text[]) ORDER BY file`;

const SELECT_INGREDIENTS = `
  SELECT recipe_key, name, household_measure, quantity, unit, optional
  FROM recipe_ingredient WHERE recipe_key = ANY($1::text[]) ORDER BY recipe_key, position`;

type RecipeRow = {
  file: string;
  source_menu: number;
  title: string;
  total_min: number | null;
  preparation_min: number | null;
  cooking_min: number | null;
  resting_min: number | null;
  preparation: string[];
};

// `pg` returns `numeric` as a string, so that no precision is lost; the quantities are small and fit a number.
type IngredientRow = {
  recipe_key: string;
  name: string;
  household_measure: string | null;
  quantity: string | null;
  unit: Unit | null;
  optional: boolean;
};

/** The recipes in Postgres: one row per recipe file (the file is the key) and its ingredients in order. */
export class PostgresRecipeRepository implements RecipeRepository {
  constructor(private readonly pool: pg.Pool) {}

  async findByFiles(files: string[]): Promise<Result<Recipe[], RepositoryReadError>> {
    if (files.length === 0) return ok([]);
    try {
      const [recipes, ingredients] = await Promise.all([
        this.pool.query<RecipeRow>(SELECT_RECIPES, [files]),
        this.pool.query<IngredientRow>(SELECT_INGREDIENTS, [files]),
      ]);
      return ok(recipes.rows.map((row) => toRecipe(row, ingredients.rows)));
    } catch (error) {
      return err({ kind: 'read-failed', reason: describeDatabaseError(error) });
    }
  }

  /** Inserts or replaces each recipe it receives, ingredients included; the others are kept. */
  async saveAll(recipes: Recipe[]): Promise<Result<void, RepositoryError>> {
    const rows = recipes.map(({ file, sourceMenu, title, times, preparation }) => ({
      file,
      source_menu: sourceMenu,
      title,
      total_min: times.total,
      preparation_min: times.preparation,
      cooking_min: times.cooking,
      resting_min: times.resting,
      preparation,
    }));
    const ingredients = recipes.flatMap(({ file, ingredients }) =>
      ingredients.map((ingredient, i) => ({
        recipe_key: file,
        position: i + 1,
        name: ingredient.name,
        household_measure: ingredient.householdMeasure,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        optional: ingredient.optional,
      })),
    );

    try {
      await inTransaction(this.pool, async (client) => {
        await client.query(UPSERT_RECIPES, [asJson(rows)]);
        await client.query('DELETE FROM recipe_ingredient WHERE recipe_key = ANY($1::text[])', [
          recipes.map(({ file }) => file),
        ]);
        await client.query(INSERT_INGREDIENTS, [asJson(ingredients)]);
      });
      return ok(undefined);
    } catch (error) {
      return err({ kind: 'write-failed', reason: describeDatabaseError(error) });
    }
  }
}

// The key of a recipe with a file is its file, so the ingredients are matched by it.
function toRecipe(row: RecipeRow, ingredients: IngredientRow[]): Recipe {
  return {
    file: row.file,
    sourceMenu: row.source_menu,
    title: row.title,
    times: { total: row.total_min, preparation: row.preparation_min, cooking: row.cooking_min, resting: row.resting_min },
    ingredients: ingredients.filter(({ recipe_key }) => recipe_key === row.file).map(toIngredient),
    preparation: row.preparation,
  };
}

function toIngredient({ name, household_measure, quantity, unit, optional }: IngredientRow): RecipeIngredient {
  return {
    name,
    householdMeasure: household_measure,
    quantity: quantity === null ? null : Number(quantity),
    unit,
    optional,
  };
}
