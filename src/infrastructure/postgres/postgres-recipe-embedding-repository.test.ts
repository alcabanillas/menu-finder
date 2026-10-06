import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { NewEmbedding } from '@/application/ports/recipe-embedding-repository';
import type { Recipe } from '@/domain/recipe/recipe';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const VARIANT = 'name-ingredients';

const tortilla: Recipe = {
  file: 'Tortilla',
  sourceMenu: 1,
  title: 'Tortilla de patata',
  times: { total: null, preparation: null, cooking: null, resting: null },
  ingredients: [
    { name: 'patata', householdMeasure: null, quantity: 200, unit: 'g', optional: false },
    { name: 'huevo', householdMeasure: null, quantity: 120, unit: 'g', optional: false },
  ],
  preparation: ['Cuajar.'],
};

const vector = (seed: number) => Array.from({ length: 3072 }, (_, i) => ((i + seed) % 7) / 7);
const embedding = (recipeKey: string, source: string, seed = 1): NewEmbedding => ({
  recipeKey,
  model: 'gemini-embedding-2',
  dimensions: 3072,
  source,
  vector: vector(seed),
});

describe.skipIf(!TEST_DATABASE_URL)('PostgresRecipeEmbeddingRepository (Neon test branch)', () => {
  let db: TestDatabase;
  let store: PostgresRecipeEmbeddingRepository;
  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    store = new PostgresRecipeEmbeddingRepository(db.pool);
  });
  beforeEach(async () => {
    await db.truncate();
    await new PostgresRecipeRepository(db.pool).saveAll([tortilla]);
    await new PostgresMenuRepository(db.pool).saveAll([
      {
        number: 1,
        meals: [
          {
            day: 'monday',
            type: 'lunch',
            dishes: [
              { position: 1, name: 'Tortilla de patata', hasRecipeMark: true, recipeFile: 'Tortilla' },
              { position: 2, name: 'Fruta', hasRecipeMark: false, recipeFile: null },
            ],
          },
        ],
      },
    ]);
  });
  afterAll(async () => {
    await db.drop();
  });

  it('lists every recipe row with its ingredient names in order, the name-only rows included', async () => {
    expect(await store.documents(VARIANT)).toEqual({
      ok: true,
      value: [
        { recipeKey: 'Tortilla', title: 'Tortilla de patata', ingredientNames: ['patata', 'huevo'], stored: null },
        { recipeKey: 'dish:Fruta', title: 'Fruta', ingredientNames: [], stored: null },
      ],
    });
  });

  it('stores the vectors and gives back the model and text they came from', async () => {
    expect(await store.saveAll(VARIANT, [embedding('Tortilla', 'first')])).toEqual({ ok: true, value: undefined });

    const result = await store.documents(VARIANT);

    expect(result.ok && result.value[0].stored).toEqual({ model: 'gemini-embedding-2', source: 'first' });
    expect(result.ok && result.value[1].stored).toBeNull();
  });

  it('replaces the vector of a recipe saved again', async () => {
    await store.saveAll(VARIANT, [embedding('Tortilla', 'first', 1)]);
    await store.saveAll(VARIANT, [embedding('Tortilla', 'second', 2)]);

    // Stored as `float4`: compared by distance, not by text.
    const { rows } = await db.pool.query('SELECT source, embedding <-> $1::vector AS distance FROM recipe_embedding', [
      `[${vector(2).join(',')}]`,
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('second');
    expect(rows[0].distance).toBeLessThan(1e-4);
  });

  it('only gives back the vectors of the variant asked for', async () => {
    await store.saveAll('other-variant', [embedding('Tortilla', 'first')]);

    const result = await store.documents(VARIANT);

    expect(result.ok && result.value[0].stored).toBeNull();
  });

  it('gives the cosine similarity of a vector to the recipe of every menu dish, addressed by dish', async () => {
    await store.saveAll(VARIANT, [embedding('Tortilla', 'first', 1), embedding('dish:Fruta', 'first', 3)]);

    const result = await store.similarities(VARIANT, vector(1));

    expect(result.ok && result.value.map(({ dish }) => dish)).toEqual([
      { menu: 1, day: 'monday', meal: 'lunch', position: 1 },
      { menu: 1, day: 'monday', meal: 'lunch', position: 2 },
    ]);
    const [tortillaDish, frutaDish] = result.ok ? result.value.map(({ similarity }) => similarity) : [];
    expect(tortillaDish).toBeCloseTo(1, 4);
    expect(frutaDish).toBeLessThan(tortillaDish);
  });

  it('gives no similarity when no embedding of the variant is stored', async () => {
    await store.saveAll('other-variant', [embedding('Tortilla', 'first')]);

    expect(await store.similarities(VARIANT, vector(1))).toEqual({ ok: true, value: [] });
  });

  it('returns the database error for a vector of the wrong size', async () => {
    await store.saveAll(VARIANT, [embedding('Tortilla', 'first')]);

    expect(await store.similarities(VARIANT, [1, 2, 3])).toMatchObject({ ok: false, error: { kind: 'store-failed' } });
  });

  it('saves no vector when one of them is wrong', async () => {
    const result = await store.saveAll(VARIANT, [
      embedding('Tortilla', 'first'),
      { ...embedding('dish:Fruta', 'first'), vector: [1, 2, 3] },
    ]);

    expect(result.ok).toBe(false);
    expect((await db.pool.query('SELECT recipe_key FROM recipe_embedding')).rows).toEqual([]);
  });
});
