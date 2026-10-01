import type { ContentAnomaly } from "@/domain/recipe-ingestion/content-anomalies";
import type { DivergentRecipe, RecipeField } from "@/domain/recipe-ingestion/select-versions";
import type { LayoutAnomaly, SourceError } from "@/application/ports/document-source";
import type { RepositoryError } from "@/application/ports/menu-repository";

export type RecipeFailure = { menu: number; file: string; error: SourceError };

export type RecipeAnomaly = LayoutAnomaly | ContentAnomaly;

export type RecipeAnomalyRow = { menu: number; file: string; anomaly: RecipeAnomaly };

export type MenuRecipeCount = { menu: number; files: number; parsed: number };

/** The content figures are computed over the saved recipes, one per file. */
export type IngestRecipesTotals = {
  filesFound: number;
  filesParsed: number;
  distinctFiles: number;
  repeatedFiles: number;
  divergentFiles: number;
  divergentByField: Record<RecipeField, number>;
  withTotalTime: number;
  withPreparation: number;
  paragraphs: number;
  ingredients: number;
  ingredientsWithQuantity: number;
  optionalIngredients: number;
  /** Lowercased, not otherwise normalized. */
  distinctIngredientNames: number;
  /** Ingredient count per unit; `none` for ingredients without a readable unit. */
  ingredientsByUnit: Record<string, number>;
};

export type IngestRecipesSummary = {
  perMenu: MenuRecipeCount[];
  failures: RecipeFailure[];
  anomalies: RecipeAnomalyRow[];
  divergent: DivergentRecipe[];
  totals: IngestRecipesTotals;
};

export type IngestRecipesError =
  | { kind: "source-unavailable"; error: SourceError }
  | { kind: "no-recipe-parsed"; failures: RecipeFailure[] }
  | { kind: "save-failed"; error: RepositoryError };
