import { describe, expect, it } from 'vitest';
import type { RecipeContent } from '@/domain/recipe/recipe';
import { checkRecipeContent } from '@/domain/recipe/content-anomalies';

const complete: RecipeContent = {
  title: 'Guiso de prueba',
  times: { total: 30, preparation: 10, cooking: 20, resting: null },
  ingredients: [{ name: 'Garbanzo', householdMeasure: null, quantity: 100, unit: 'g', optional: false }],
  preparation: ['Cocer.'],
};

describe('checkRecipeContent', () => {
  it('reports nothing for a complete recipe', () => {
    expect(checkRecipeContent(complete)).toEqual([]);
  });

  it('reports a recipe with no ingredients', () => {
    expect(checkRecipeContent({ ...complete, ingredients: [] })).toEqual([{ kind: 'no-ingredients' }]);
  });

  it('reports an empty preparation', () => {
    expect(checkRecipeContent({ ...complete, preparation: [] })).toEqual([{ kind: 'empty-preparation' }]);
  });

  it('reports a missing total time', () => {
    expect(checkRecipeContent({ ...complete, times: { ...complete.times, total: null } })).toEqual([
      { kind: 'missing-total-time' },
    ]);
  });
});
