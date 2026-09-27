import type { Recipe } from "@/domain/recipe/recipe";
import { checkRecipeContent } from "@/domain/recipe-ingestion/content-anomalies";
import {
  selectRecipeVersions,
  type DivergentRecipe,
  type RecipeField,
  type RecipeVersion,
} from "@/domain/recipe-ingestion/select-versions";
import { err, ok, type Result } from "@/shared/result";
import type {
  IngestRecipesError,
  IngestRecipesSummary,
  IngestRecipesTotals,
  MenuRecipeCount,
  RecipeAnomalyRow,
  RecipeFailure,
} from "../dto/ingest-recipes";
import type { DocumentSource } from "../ports/document-source";
import type { RecipeRepository } from "../ports/recipe-repository";

export type IngestRecipesDeps = { source: DocumentSource; recipes: RecipeRepository };

const NO_UNIT = "none";

const countBy = <T>(items: T[], matches: (item: T) => boolean): number => items.filter(matches).length;

function computeTotals(
  recipes: Recipe[],
  perMenu: MenuRecipeCount[],
  repeatedFiles: number,
  divergent: DivergentRecipe[],
): IngestRecipesTotals {
  const ingredients = recipes.flatMap((recipe) => recipe.ingredients);
  const divergentByField = (field: RecipeField) => countBy(divergent, (file) => file.fields.includes(field));
  const ingredientsByUnit: Record<string, number> = {};
  for (const { unit } of ingredients) ingredientsByUnit[unit ?? NO_UNIT] = (ingredientsByUnit[unit ?? NO_UNIT] ?? 0) + 1;

  return {
    filesFound: perMenu.reduce((sum, menu) => sum + menu.files, 0),
    filesParsed: perMenu.reduce((sum, menu) => sum + menu.parsed, 0),
    distinctFiles: recipes.length,
    repeatedFiles,
    divergentFiles: divergent.length,
    divergentByField: {
      title: divergentByField("title"),
      times: divergentByField("times"),
      ingredients: divergentByField("ingredients"),
      preparation: divergentByField("preparation"),
    },
    withTotalTime: countBy(recipes, (recipe) => recipe.times.total !== null),
    withPreparation: countBy(recipes, (recipe) => recipe.preparation.length > 0),
    paragraphs: recipes.reduce((sum, recipe) => sum + recipe.preparation.length, 0),
    ingredients: ingredients.length,
    ingredientsWithQuantity: countBy(ingredients, (ingredient) => ingredient.quantity !== null),
    optionalIngredients: countBy(ingredients, (ingredient) => ingredient.optional),
    distinctIngredientNames: new Set(ingredients.map((ingredient) => ingredient.name.toLowerCase())).size,
    ingredientsByUnit,
  };
}

/**
 * Reads every recipe file of every menu, in numeric menu order and file name
 * order, keeps one recipe per file (the highest menu's version) and saves
 * them. A file that fails is recorded and the others go on; nothing is saved
 * when no recipe could be read.
 */
export async function ingestRecipes({
  source,
  recipes,
}: IngestRecipesDeps): Promise<Result<IngestRecipesSummary, IngestRecipesError>> {
  const folders = await source.listMenuFolders();
  if (!folders.ok) return err({ kind: "source-unavailable", error: folders.error });

  const versions: RecipeVersion[] = [];
  const failures: RecipeFailure[] = [];
  const anomalies: RecipeAnomalyRow[] = [];
  const perMenu: MenuRecipeCount[] = [];

  for (const folder of [...folders.value].sort((a, b) => a.number - b.number)) {
    const files = [...(await source.listRecipeFiles(folder))].sort();
    let parsed = 0;
    for (const file of files) {
      const read = await source.readRecipe(folder, file);
      if (!read.ok) {
        failures.push({ menu: folder.number, file, error: read.error });
        continue;
      }
      parsed++;
      const { content } = read.value;
      versions.push({ menu: folder.number, file, content });
      for (const anomaly of [...read.value.anomalies, ...checkRecipeContent(content)]) {
        anomalies.push({ menu: folder.number, file, anomaly });
      }
    }
    perMenu.push({ menu: folder.number, files: files.length, parsed });
  }

  if (versions.length === 0) return err({ kind: "no-recipe-parsed", failures });

  const selection = selectRecipeVersions(versions);
  const saved = await recipes.saveAll(selection.recipes);
  if (!saved.ok) return err({ kind: "save-failed", error: saved.error });

  return ok({
    perMenu,
    failures,
    anomalies,
    divergent: selection.divergent,
    totals: computeTotals(selection.recipes, perMenu, selection.repeatedFiles, selection.divergent),
  });
}
