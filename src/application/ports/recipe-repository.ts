import type { FoodGroup } from '@/domain/recipe/food-group';
import type { Recipe } from '@/domain/recipe/recipe';
import type { Result } from '@/shared/result';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';

export type StoredIngredientGroup = {
  foodGroups: FoodGroup[];
  model: string;
};

export type IngredientToClassify = {
  name: string;
  stored: StoredIngredientGroup | null;
};

export type NewIngredientGroup = {
  ingredientName: string;
  foodGroups: FoodGroup[];
  model: string;
};

export interface RecipeRepository {
  /** Stores the given recipes. It must not remove recipes it did not receive. */
  saveAll(recipes: Recipe[]): Promise<Result<void, RepositoryError>>;
  /** The stored recipes of those files, whole; a file with no stored recipe is left out. */
  findByFiles(files: string[]): Promise<Result<Recipe[], RepositoryReadError>>;
  /** Distinct ingredient names in `recipe_ingredient` with their stored food groups if already classified. */
  ingredientGroups(): Promise<Result<IngredientToClassify[], RepositoryReadError>>;
  /** Upserts the classified ingredient groups in one transaction. */
  saveIngredientGroups(groups: NewIngredientGroup[]): Promise<Result<void, RepositoryError>>;
}
