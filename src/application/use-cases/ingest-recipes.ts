import type { Recipe, RecipeIngredient } from '@/domain/recipe/recipe';
import { checkRecipeContent } from '@/domain/recipe/content-anomalies';
import {
  selectRecipeVersions,
  type DivergentRecipe,
  type RecipeField,
  type RecipeVersion,
} from '@/domain/recipe/select-versions';
import { err, ok, type Result } from '@/shared/result';
import type {
  IngestRecipesError,
  IngestRecipesSummary,
  IngestRecipesTotals,
  MenuRecipeCount,
  RecipeAnomalyRow,
  RecipeFailure,
} from '@/application/dto/ingest-recipes';
import type { DocumentSource, MenuFolder } from '@/application/ports/document-source';
import type { RecipeRepository } from '@/application/ports/recipe-repository';

export type IngestRecipesDeps = { source: DocumentSource; recipes: Pick<RecipeRepository, 'saveAll'> };

const NO_UNIT = 'none';

type ReadRecipes = {
  versions: RecipeVersion[];
  failures: RecipeFailure[];
  anomalies: RecipeAnomalyRow[];
  perMenu: MenuRecipeCount[];
};

/**
 * Reads every recipe file of every menu, keeps one recipe per file (the
 * highest menu's version) and saves them. Nothing is saved when no recipe
 * could be read.
 */
export async function ingestRecipes({
  source,
  recipes,
}: IngestRecipesDeps): Promise<Result<IngestRecipesSummary, IngestRecipesError>> {
  const folders = await source.listMenuFolders();
  if (!folders.ok) return err({ kind: 'source-unavailable', error: folders.error });

  const { versions, failures, anomalies, perMenu } = await readRecipes(source, folders.value);
  if (versions.length === 0) return err({ kind: 'no-recipe-parsed', failures });

  const selection = selectRecipeVersions(versions);
  const saved = await recipes.saveAll(selection.recipes);
  if (!saved.ok) return err({ kind: 'save-failed', error: saved.error });

  return ok({
    perMenu,
    failures,
    anomalies,
    divergent: selection.divergent,
    totals: computeTotals(selection.recipes, perMenu, selection.repeatedFiles, selection.divergent),
  });
}

/** Reads every recipe file of every menu, in numeric menu order. A file that fails is recorded and the others go on. */
async function readRecipes(source: DocumentSource, folders: MenuFolder[]): Promise<ReadRecipes> {
  const read: ReadRecipes = { versions: [], failures: [], anomalies: [], perMenu: [] };
  for (const folder of [...folders].sort((a, b) => a.number - b.number)) await readFolder(source, folder, read);
  return read;
}

/** Reads the recipe files of one menu folder in file name order, recording failures and anomalies in `read`. */
async function readFolder(source: DocumentSource, folder: MenuFolder, read: ReadRecipes): Promise<void> {
  const files = [...(await source.listRecipeFiles(folder))].sort();
  let parsed = 0;
  for (const file of files) {
    const recipe = await source.readRecipe(folder, file);
    if (!recipe.ok) {
      read.failures.push({ menu: folder.number, file, error: recipe.error });
      continue;
    }
    parsed += 1;
    const { content, anomalies } = recipe.value;
    read.versions.push({ menu: folder.number, file, content });
    for (const anomaly of [...anomalies, ...checkRecipeContent(content)]) {
      read.anomalies.push({ menu: folder.number, file, anomaly });
    }
  }
  read.perMenu.push({ menu: folder.number, files: files.length, parsed });
}

function computeTotals(
  recipes: Recipe[],
  perMenu: MenuRecipeCount[],
  repeatedFiles: number,
  divergent: DivergentRecipe[],
): IngestRecipesTotals {
  const ingredients = recipes.flatMap((recipe) => recipe.ingredients);
  const divergentByField = (field: RecipeField) => countBy(divergent, (file) => file.fields.includes(field));

  return {
    filesFound: sumOf(perMenu, (menu) => menu.files),
    filesParsed: sumOf(perMenu, (menu) => menu.parsed),
    distinctFiles: recipes.length,
    repeatedFiles,
    divergentFiles: divergent.length,
    divergentByField: {
      title: divergentByField('title'),
      times: divergentByField('times'),
      ingredients: divergentByField('ingredients'),
      preparation: divergentByField('preparation'),
    },
    withTotalTime: countBy(recipes, (recipe) => recipe.times.total !== null),
    withPreparation: countBy(recipes, (recipe) => recipe.preparation.length > 0),
    paragraphs: sumOf(recipes, (recipe) => recipe.preparation.length),
    ingredients: ingredients.length,
    ingredientsWithQuantity: countBy(ingredients, (ingredient) => ingredient.quantity !== null),
    optionalIngredients: countBy(ingredients, (ingredient) => ingredient.optional),
    distinctIngredientNames: new Set(ingredients.map((ingredient) => ingredient.name.toLowerCase())).size,
    ingredientsByUnit: countByUnit(ingredients),
  };
}

function countBy<T>(items: T[], matches: (item: T) => boolean): number {
  return items.filter(matches).length;
}

function sumOf<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((sum, item) => sum + value(item), 0);
}

function countByUnit(ingredients: RecipeIngredient[]): Record<string, number> {
  const byUnit: Record<string, number> = {};
  for (const { unit } of ingredients) {
    const key = unit ?? NO_UNIT;
    byUnit[key] = (byUnit[key] ?? 0) + 1;
  }
  return byUnit;
}
