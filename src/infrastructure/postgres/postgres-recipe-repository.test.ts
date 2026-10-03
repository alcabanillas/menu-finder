import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Recipe } from '@/domain/recipe/recipe';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const tortilla: Recipe = {
  file: 'Tortilla',
  sourceMenu: 3,
  title: 'Tortilla de patata',
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [
    { name: 'huevo', householdMeasure: null, quantity: 120, unit: 'g', optional: false },
    { name: 'sal', householdMeasure: 'al gusto', quantity: null, unit: null, optional: true },
  ],
  preparation: ['Pelar las patatas.', 'Cuajar.'],
};
const crema: Recipe = { ...tortilla, file: 'Crema', title: 'Crema de calabaza', ingredients: [tortilla.ingredients[0]] };

describe.skipIf(!TEST_DATABASE_URL)('PostgresRecipeRepository (Neon test branch)', () => {
  let db: TestDatabase;
  let recipes: PostgresRecipeRepository;
  beforeEach(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    recipes = new PostgresRecipeRepository(db.pool);
  });
  afterEach(async () => {
    await db.drop();
  });

  const stored = async () => {
    const { rows: recipeRows } = await db.pool.query(
      `SELECT key, file, source_menu, title, total_min, preparation_min, cooking_min, resting_min, preparation
       FROM recipe ORDER BY key`,
    );
    const { rows: ingredientRows } = await db.pool.query(
      `SELECT recipe_key, position, name, household_measure, quantity::float AS quantity, unit, optional
       FROM recipe_ingredient ORDER BY recipe_key, position`,
    );
    return { recipeRows, ingredientRows };
  };

  it('stores each recipe whole: times, ingredients in order and preparation paragraphs in order', async () => {
    expect(await recipes.saveAll([tortilla])).toEqual({ ok: true, value: undefined });

    const { recipeRows, ingredientRows } = await stored();
    expect(recipeRows).toEqual([
      {
        key: 'Tortilla',
        file: 'Tortilla',
        source_menu: 3,
        title: 'Tortilla de patata',
        total_min: 30,
        preparation_min: 10,
        cooking_min: 20,
        resting_min: null,
        preparation: ['Pelar las patatas.', 'Cuajar.'],
      },
    ]);
    expect(ingredientRows).toEqual([
      { recipe_key: 'Tortilla', position: 1, name: 'huevo', household_measure: null, quantity: 120, unit: 'g', optional: false },
      { recipe_key: 'Tortilla', position: 2, name: 'sal', household_measure: 'al gusto', quantity: null, unit: null, optional: true },
    ]);
  });

  it('replaces a recipe saved again, ingredients included', async () => {
    await recipes.saveAll([tortilla]);
    await recipes.saveAll([{ ...tortilla, title: 'Tortilla francesa', ingredients: [tortilla.ingredients[0]] }]);

    const { recipeRows, ingredientRows } = await stored();
    expect(recipeRows.map((row) => row.title)).toEqual(['Tortilla francesa']);
    expect(ingredientRows.map((row) => row.name)).toEqual(['huevo']);
  });

  it('keeps the recipes it did not receive', async () => {
    await recipes.saveAll([tortilla, crema]);
    await recipes.saveAll([tortilla]);

    const { recipeRows } = await stored();
    expect(recipeRows.map((row) => row.key)).toEqual(['Crema', 'Tortilla']);
  });

  it('returns the database error and leaves no recipe when the save fails half-way', async () => {
    await db.pool.query('DROP TABLE recipe_ingredient');

    const result = await recipes.saveAll([tortilla]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.reason).toContain('recipe_ingredient');
    expect((await db.pool.query('SELECT key FROM recipe')).rows).toEqual([]);
  });
});
