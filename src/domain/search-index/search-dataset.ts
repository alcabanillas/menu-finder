import type { Day, MealType, WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { Recipe, RecipeIngredient, RecipeTimes } from "@/domain/recipe/recipe";
import { err, ok, type Result } from "@/shared/result";

/** Key of the recipe row of a dish without recipe file: one per distinct dish name. */
const NAME_ONLY_PREFIX = "dish:";

/** A recipe row of the search index: a recipe file, or a dish name with no other text. */
export type IndexedRecipe = {
  /** The recipe file, or `dish:<name>` for a dish without recipe file. */
  key: string;
  file: string | null;
  sourceMenu: number | null;
  title: string;
  times: RecipeTimes | null;
  ingredients: RecipeIngredient[];
  /** `null` for a dish without recipe file. */
  preparation: string[] | null;
};

export type IndexedDish = { position: number; name: string; hasRecipeMark: boolean; recipeKey: string };

export type IndexedMeal = { day: Day; type: MealType; dishes: IndexedDish[] };

export type IndexedMenu = { number: number; meals: IndexedMeal[] };

export type SearchDataset = { menus: IndexedMenu[]; recipes: IndexedRecipe[] };

export type UnknownRecipeFile = { menu: number; dish: string; file: string };

const fromRecipe = ({ file, sourceMenu, title, times, ingredients, preparation }: Recipe): IndexedRecipe => ({
  key: file,
  file,
  sourceMenu,
  title,
  times,
  ingredients,
  preparation,
});

const nameOnly = (name: string): IndexedRecipe => ({
  key: `${NAME_ONLY_PREFIX}${name}`,
  file: null,
  sourceMenu: null,
  title: name,
  times: null,
  ingredients: [],
  preparation: null,
});

/**
 * The rows of the search index: every menu with its dishes pointing to a
 * recipe row, every recipe file (used or not) and one name-only row per
 * distinct dish name without recipe file. Fails, listing them all, when a
 * dish names a recipe file that is not in the recipes.
 */
export function buildSearchDataset(menus: WeeklyMenu[], recipes: Recipe[]): Result<SearchDataset, UnknownRecipeFile[]> {
  const files = new Set(recipes.map((recipe) => recipe.file));
  const rows = new Map(recipes.map((recipe) => [recipe.file, fromRecipe(recipe)]));
  const unknown: UnknownRecipeFile[] = [];

  const indexed = menus.map(({ number, meals }) => ({
    number,
    meals: meals.map(({ day, type, dishes }) => ({
      day,
      type,
      dishes: dishes.map(({ position, name, hasRecipeMark, recipeFile }): IndexedDish => {
        if (recipeFile !== null && !files.has(recipeFile)) unknown.push({ menu: number, dish: name, file: recipeFile });
        const row = recipeFile === null ? nameOnly(name) : rows.get(recipeFile);
        if (row && !rows.has(row.key)) rows.set(row.key, row);
        return { position, name, hasRecipeMark, recipeKey: row?.key ?? "" };
      }),
    })),
  }));

  if (unknown.length > 0) return err(unknown);
  const sorted = [...rows.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  return ok({ menus: indexed, recipes: sorted });
}

/** The text of a recipe row that is embedded: its title and ingredient names, never the preparation. */
export type EmbeddingDocument = { title: string; content: string };

export function embeddingDocument(recipe: IndexedRecipe): EmbeddingDocument {
  const names = recipe.ingredients.map((ingredient) => ingredient.name);
  return { title: recipe.title, content: names.length > 0 ? names.join(", ") : recipe.title };
}

/** What an embedding was computed from: the same source means the embedding can be kept. */
export const embeddingSource = ({ title, content }: EmbeddingDocument): string => `${title}\n${content}`;
