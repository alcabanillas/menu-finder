import type { RecipeContent } from '@/domain/recipe/recipe';

/** What a parsed recipe lacks, whatever the source it came from. */
export type ContentAnomaly = { kind: 'no-ingredients' } | { kind: 'empty-preparation' } | { kind: 'missing-total-time' };

/** Content a parsed recipe lacks: total time, ingredients or preparation. They go to the QA report; the recipe is still saved. */
export function checkRecipeContent({ times, ingredients, preparation }: RecipeContent): ContentAnomaly[] {
  const anomalies: ContentAnomaly[] = [];
  if (times.total === null) anomalies.push({ kind: 'missing-total-time' });
  if (ingredients.length === 0) anomalies.push({ kind: 'no-ingredients' });
  if (preparation.length === 0) anomalies.push({ kind: 'empty-preparation' });
  return anomalies;
}
