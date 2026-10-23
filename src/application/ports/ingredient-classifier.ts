import { z } from 'zod';
import { FOOD_GROUPS } from '@/domain/recipe/food-group';
import type { Result } from '@/shared/result';

export type IngredientClassifierError = { kind: 'classifier-failed'; reason: string };

const classifiedItemSchema = z.strictObject({
  name: z.string().trim().min(1),
  groups: z.array(z.enum(FOOD_GROUPS)),
});

export const ingredientClassificationSchema = z.strictObject({
  items: z.array(classifiedItemSchema),
});

export interface IngredientClassifier {
  readonly model: string;
  classify(ingredientNames: string[]): Promise<Result<unknown, IngredientClassifierError>>;
}
