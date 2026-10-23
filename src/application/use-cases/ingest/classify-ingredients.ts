import type {
  ClassifyIngredientsError,
  ClassifyIngredientsSummary,
} from '@/application/dto/classify-ingredients';
import {
  ingredientClassificationSchema,
  type IngredientClassifier,
} from '@/application/ports/ingredient-classifier';
import type {
  NewIngredientGroup,
  RecipeRepository,
} from '@/application/ports/recipe-repository';
import type { FoodGroup } from '@/domain/recipe/food-group';
import { err, ok, type Result } from '@/shared/result';

export type ClassifyIngredientsDeps = {
  recipes: Pick<RecipeRepository, 'ingredientGroups' | 'saveIngredientGroups'>;
  classifier: IngredientClassifier;
};

/**
 * `pnpm ingest ingredient-groups`: classifies distinct recipe ingredient names into canonical food groups.
 * Only ingredients with no stored classification or classified by another model are sent to the classifier.
 */
export async function classifyIngredients({
  recipes,
  classifier,
}: ClassifyIngredientsDeps): Promise<Result<ClassifyIngredientsSummary, ClassifyIngredientsError>> {
  const stored = await recipes.ingredientGroups();
  if (!stored.ok) return stored;
  if (stored.value.length === 0) return err({ kind: 'recipes-empty' });

  const pending = stored.value.filter(({ stored: s }) => s?.model !== classifier.model);
  const summary: ClassifyIngredientsSummary = {
    ingredients: stored.value.length,
    classified: pending.length,
    kept: stored.value.length - pending.length,
    model: classifier.model,
  };
  if (pending.length === 0) return ok(summary);

  const pendingNames = pending.map(({ name }) => name);
  const classified = await classifier.classify(pendingNames);
  if (!classified.ok) return classified;

  const validated = validateClassification(pendingNames, classified.value);
  if (!validated.ok) return validated;

  const toSave: NewIngredientGroup[] = pendingNames.map((name) => ({
    ingredientName: name,
    foodGroups: validated.value.get(name) as FoodGroup[],
    model: classifier.model,
  }));

  const saved = await recipes.saveIngredientGroups(toSave);
  return saved.ok ? ok(summary) : saved;
}

function validateClassification(
  expectedNames: string[],
  raw: unknown,
): Result<Map<string, FoodGroup[]>, { kind: 'invalid-classification'; reason: string }> {
  const parsed = ingredientClassificationSchema.safeParse(raw);
  if (!parsed.success) {
    return invalid(parsed.error.message);
  }

  const byName = new Map<string, FoodGroup[]>();
  for (const { name, groups } of parsed.data.items) {
    byName.set(name, [...new Set(groups)]);
  }

  if (byName.size !== expectedNames.length) {
    return invalid(`expected ${expectedNames.length} distinct ingredients, received ${byName.size}`);
  }

  for (const name of expectedNames) {
    if (!byName.has(name)) {
      return invalid(`missing classification for ingredient: ${name}`);
    }
  }

  return ok(byName);
}

function invalid(reason: string): Result<never, { kind: 'invalid-classification'; reason: string }> {
  return err({ kind: 'invalid-classification', reason });
}
