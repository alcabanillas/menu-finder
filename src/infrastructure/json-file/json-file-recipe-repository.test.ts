import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Recipe } from '@/domain/recipe/recipe';
import { ok } from '@/shared/result';
import { JsonFileRecipeRepository } from '@/infrastructure/json-file/json-file-recipe-repository';

const RECIPE: Recipe = {
  file: 'Guiso-de-prueba',
  sourceMenu: 4,
  title: 'Guiso de prueba',
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [{ name: 'Garbanzo', householdMeasure: '1 taza', quantity: 100, unit: 'g', optional: false }],
  preparation: ['Cocer.'],
};

describe('JsonFileRecipeRepository', () => {
  let dataDir: string;

  beforeEach(async () => {
    dataDir = await mkdtemp(join(tmpdir(), 'recipe-repository-'));
  });
  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  const readSaved = async () => JSON.parse(await readFile(join(dataDir, 'recetas.json'), 'utf8'));

  it('writes recetas.json with exactly the recipe fields', async () => {
    const result = await new JsonFileRecipeRepository(dataDir).saveAll([RECIPE]);

    expect(result).toEqual(ok(undefined));
    // Fixes the file's keys: renaming an entity field must fail here, not change the file silently.
    expect(await readSaved()).toEqual([
      {
        file: 'Guiso-de-prueba',
        sourceMenu: 4,
        title: 'Guiso de prueba',
        times: { total: 30, preparation: 10, cooking: 20, resting: null },
        ingredients: [{ name: 'Garbanzo', householdMeasure: '1 taza', quantity: 100, unit: 'g', optional: false }],
        preparation: ['Cocer.'],
      },
    ]);
  });

  it('overwrites a previous file', async () => {
    await writeFile(join(dataDir, 'recetas.json'), '[{"menu":"1","fichero":"Viejo","anomalias":0}]');

    await new JsonFileRecipeRepository(dataDir).saveAll([RECIPE]);

    expect((await readSaved()).map((recipe: Recipe) => recipe.file)).toEqual(['Guiso-de-prueba']);
  });

  it('returns an error instead of throwing when the file cannot be written', async () => {
    const result = await new JsonFileRecipeRepository(join(dataDir, 'missing', 'dir')).saveAll([RECIPE]);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.kind).toBe('write-failed');
  });
});
