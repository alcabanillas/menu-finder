import type { Recipe } from "@/domain/recipe/recipe";
import type { Result } from "@/shared/result";
import type { RepositoryError } from "@/application/ports/repository-error";

export interface RecipeRepository {
  /** Stores the given recipes. It must not remove recipes it did not receive. */
  saveAll(recipes: Recipe[]): Promise<Result<void, RepositoryError>>;
}
