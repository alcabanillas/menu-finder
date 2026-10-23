import { describe, expect, it } from 'vitest';
import type {
  IngredientClassifier,
  IngredientClassifierError,
} from '@/application/ports/ingredient-classifier';
import type {
  IngredientToClassify,
  NewIngredientGroup,
  RecipeRepository,
} from '@/application/ports/recipe-repository';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import { classifyIngredients } from '@/application/use-cases/ingest/classify-ingredients';
import { err, ok, type Result } from '@/shared/result';

const MODEL = 'gemini-3.8-flash';

function fakeClassifier(
  canned?: unknown,
  fail = false,
): { classifier: IngredientClassifier; calls: string[][] } {
  const calls: string[][] = [];
  const classifier: IngredientClassifier = {
    model: MODEL,
    async classify(names: string[]): Promise<Result<unknown, IngredientClassifierError>> {
      calls.push(names);
      if (fail) return err({ kind: 'classifier-failed', reason: '503 Service Unavailable' });
      return ok(canned ?? { items: names.map((name) => ({ name, groups: [] })) });
    },
  };
  return { classifier, calls };
}

function fakeRecipes(
  stored: IngredientToClassify[],
  failSave = false,
  failRead = false,
): {
  recipes: Pick<RecipeRepository, 'ingredientGroups' | 'saveIngredientGroups'>;
  saved: NewIngredientGroup[][];
} {
  const saved: NewIngredientGroup[][] = [];
  const recipes = {
    async ingredientGroups(): Promise<Result<IngredientToClassify[], RepositoryReadError>> {
      if (failRead) return err({ kind: 'read-failed', reason: 'db read failed' });
      return ok(stored);
    },
    async saveIngredientGroups(groups: NewIngredientGroup[]): Promise<Result<void, RepositoryError>> {
      if (failSave) return err({ kind: 'write-failed', reason: 'db write failed' });
      saved.push(groups);
      return ok(undefined);
    },
  };
  return { recipes, saved };
}

describe('classifyIngredients', () => {
  it('classifies only ingredients with no row or classified by another model', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const arroz: IngredientToClassify = {
      name: 'arroz',
      stored: { foodGroups: ['arroz'], model: 'old-model' },
    };
    const pollo: IngredientToClassify = {
      name: 'pollo',
      stored: { foodGroups: ['pollo', 'carne'], model: MODEL },
    };
    const { recipes, saved } = fakeRecipes([gamba, arroz, pollo]);
    const { classifier, calls } = fakeClassifier({
      items: [
        { name: 'gamba pelada', groups: ['marisco'] },
        { name: 'arroz', groups: ['arroz'] },
      ],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(calls).toEqual([['gamba pelada', 'arroz']]);
    expect(saved).toEqual([
      [
        { ingredientName: 'gamba pelada', foodGroups: ['marisco'], model: MODEL },
        { ingredientName: 'arroz', foodGroups: ['arroz'], model: MODEL },
      ],
    ]);
    expect(result).toEqual(ok({ ingredients: 3, classified: 2, kept: 1, model: MODEL }));
  });

  it('stores an empty array when an ingredient belongs to no canonical food group', async () => {
    const sal: IngredientToClassify = { name: 'sal', stored: null };
    const { recipes, saved } = fakeRecipes([sal]);
    const { classifier } = fakeClassifier({
      items: [{ name: 'sal', groups: [] }],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(saved).toEqual([[{ ingredientName: 'sal', foodGroups: [], model: MODEL }]]);
    expect(result).toEqual(ok({ ingredients: 1, classified: 1, kept: 0, model: MODEL }));
  });

  it('makes no model call when every ingredient is already classified with the current model', async () => {
    const gamba: IngredientToClassify = {
      name: 'gamba pelada',
      stored: { foodGroups: ['marisco'], model: MODEL },
    };
    const sal: IngredientToClassify = { name: 'sal', stored: { foodGroups: [], model: MODEL } };
    const { recipes, saved } = fakeRecipes([gamba, sal]);
    const { classifier, calls } = fakeClassifier();

    const result = await classifyIngredients({ recipes, classifier });

    expect(calls).toEqual([]);
    expect(saved).toEqual([]);
    expect(result).toEqual(ok({ ingredients: 2, classified: 0, kept: 2, model: MODEL }));
  });

  it('returns recipes-empty when ingredientGroups is empty', async () => {
    const { recipes, saved } = fakeRecipes([]);
    const { classifier, calls } = fakeClassifier();

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toEqual(err({ kind: 'recipes-empty' }));
    expect(calls).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('returns invalid-classification and writes nothing when the model omits an ingredient', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const pollo: IngredientToClassify = { name: 'pollo', stored: null };
    const { recipes, saved } = fakeRecipes([gamba, pollo]);
    const { classifier } = fakeClassifier({
      items: [{ name: 'gamba pelada', groups: ['marisco'] }],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-classification' },
    });
    expect(saved).toEqual([]);
  });

  it('returns invalid-classification and writes nothing when the model adds an unknown ingredient', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const { recipes, saved } = fakeRecipes([gamba]);
    const { classifier } = fakeClassifier({
      items: [
        { name: 'gamba pelada', groups: ['marisco'] },
        { name: 'invented ingredient', groups: ['carne'] },
      ],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-classification' },
    });
    expect(saved).toEqual([]);
  });

  it('returns invalid-classification and writes nothing when the model returns a substituted ingredient', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const { recipes, saved } = fakeRecipes([gamba]);
    const { classifier } = fakeClassifier({
      items: [{ name: 'pollo', groups: ['pollo'] }],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-classification', reason: expect.stringContaining('gamba pelada') },
    });
    expect(saved).toEqual([]);
  });

  it('returns invalid-classification and writes nothing when the model returns a non-canonical group', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const { recipes, saved } = fakeRecipes([gamba]);
    const { classifier } = fakeClassifier({
      items: [{ name: 'gamba pelada', groups: ['not-a-group'] }],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'invalid-classification' },
    });
    expect(saved).toEqual([]);
  });

  it('propagates classifier errors without writing', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const { recipes, saved } = fakeRecipes([gamba]);
    const { classifier } = fakeClassifier(undefined, true);

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toEqual(err({ kind: 'classifier-failed', reason: '503 Service Unavailable' }));
    expect(saved).toEqual([]);
  });

  it('propagates repository read errors without calling the classifier', async () => {
    const { recipes, saved } = fakeRecipes([], false, true);
    const { classifier, calls } = fakeClassifier();

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toEqual(err({ kind: 'read-failed', reason: 'db read failed' }));
    expect(calls).toEqual([]);
    expect(saved).toEqual([]);
  });

  it('propagates repository write errors when saving fails', async () => {
    const gamba: IngredientToClassify = { name: 'gamba pelada', stored: null };
    const { recipes } = fakeRecipes([gamba], true);
    const { classifier } = fakeClassifier({
      items: [{ name: 'gamba pelada', groups: ['marisco'] }],
    });

    const result = await classifyIngredients({ recipes, classifier });

    expect(result).toEqual(err({ kind: 'write-failed', reason: 'db write failed' }));
  });
});
