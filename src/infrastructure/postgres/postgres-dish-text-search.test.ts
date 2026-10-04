import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MenuDish } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

function recipe(file: string, title: string, ingredientNames: string[]): Recipe {
  return {
    file,
    sourceMenu: 1,
    title,
    times: { total: null, preparation: null, cooking: null, resting: null },
    ingredients: ingredientNames.map((name) => ({ name, householdMeasure: null, quantity: null, unit: null, optional: false })),
    preparation: ['Paso.'],
  };
}

function dish(position: number, name: string, recipeFile: string | null): MenuDish {
  return { position, name, hasRecipeMark: recipeFile !== null, recipeFile };
}

const RECIPES = [
  recipe('Salmon-horno', 'Salmón al horno', ['salmón', 'limón']),
  recipe('Ensalada-salmonete', 'Ensalada con salmonete', ['salmonete', 'lechuga']),
  recipe('Pasta-dia', 'Pasta del día', ['pasta', 'salmón ahumado']),
  recipe('Hummus', 'Hummus', ['garbanzos cocidos', 'tahini']),
  recipe('Tortilla-espinacas', 'Tortilla de espinacas', ['huevo', 'espinacas', 'patatas']),
];

const LUNCH = [
  dish(1, 'Salmón al horno', 'Salmon-horno'),
  dish(2, 'Ensalada con salmonete', 'Ensalada-salmonete'),
  dish(3, 'Tortilla de espinacas', 'Tortilla-espinacas'),
];
const DINNER = [
  dish(1, 'Pasta del día', 'Pasta-dia'),
  dish(2, 'Hummus', 'Hummus'),
  dish(3, 'Fruta', null),
  dish(4, 'Tortilla de patatas', null),
];

function at(meal: 'lunch' | 'dinner', position: number) {
  return { menu: 1, day: 'monday', meal, position };
}

describe.skipIf(!TEST_DATABASE_URL)('PostgresDishTextSearch (Neon test branch)', () => {
  let db: TestDatabase;
  let search: PostgresDishTextSearch;
  beforeEach(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    await new PostgresRecipeRepository(db.pool).saveAll(RECIPES);
    await new PostgresMenuRepository(db.pool).saveAll([
      {
        number: 1,
        meals: [
          { day: 'monday', type: 'lunch', dishes: LUNCH },
          { day: 'monday', type: 'dinner', dishes: DINNER },
        ],
      },
    ]);
    search = new PostgresDishTextSearch(db.pool);
  });
  afterEach(async () => {
    await db.drop();
  });

  it('matches whole words in the dish name, the recipe title and the ingredient names', async () => {
    expect(await search.matches('salmón')).toEqual({ ok: true, value: [at('dinner', 1), at('lunch', 1)] });
  });

  it('ignores case and accents', async () => {
    expect(await search.matches('SALMON')).toEqual({ ok: true, value: [at('dinner', 1), at('lunch', 1)] });
  });

  it('matches the Spanish word forms, so a singular finds a plural', async () => {
    expect(await search.matches('garbanzo')).toEqual({ ok: true, value: [at('dinner', 2)] });
  });

  it('matches a term of several words as a phrase, with its stopwords in between', async () => {
    expect(await search.matches('tortilla de patatas')).toEqual({ ok: true, value: [at('dinner', 4)] });
  });

  it('matches a phrase inside one ingredient name', async () => {
    expect(await search.matches('salmón ahumado')).toEqual({ ok: true, value: [at('dinner', 1)] });
  });

  it('does not match a phrase whose words are in two different ingredients', async () => {
    expect(await search.matches('salmón limón')).toEqual({ ok: true, value: [] });
  });

  it('matches a dish without recipe file by its name', async () => {
    expect(await search.matches('fruta')).toEqual({ ok: true, value: [at('dinner', 3)] });
  });

  it.each(['de', 'no'])('matches nothing, without failing, for the stopword-only term %j', async (term) => {
    expect(await search.matches(term)).toEqual({ ok: true, value: [] });
  });

  it('reads query syntax and SQL in a term as plain words and changes no data', async () => {
    const result = await search.matches("pollo & !arroz | '; DROP TABLE menu; --");

    expect(result).toEqual({ ok: true, value: [] });
    expect((await db.pool.query('SELECT number FROM menu')).rowCount).toBe(1);
  });

  it('does not fail on an emoji, a combining accent, a right-to-left mark and a 90-character word', async () => {
    const term = `salmón 🐟 ‏${'x'.repeat(90)}`;

    expect((await search.matches(term)).ok).toBe(true);
  });
});

describe('PostgresDishTextSearch', () => {
  it('returns an error, never an exception, when the database cannot be reached', async () => {
    const pool = new pg.Pool({ connectionString: 'postgres://nobody:secret@127.0.0.1:1/none', max: 1 });

    const result = await new PostgresDishTextSearch(pool).matches('pollo');
    await pool.end();

    expect(result).toMatchObject({ ok: false, error: { kind: 'text-search-failed' } });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
