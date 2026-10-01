import type { MenuDish, WeeklyMenu } from "@/domain/menu/weekly-menu";

/** Key of the recipe row of a dish without recipe file: one row per distinct dish name. */
const NAME_ONLY_PREFIX = "dish:";

/** The recipe row a dish points to: its recipe file, or a name-only row for a dish without one. */
export const recipeKeyOf = ({ name, recipeFile }: MenuDish): string => recipeFile ?? `${NAME_ONLY_PREFIX}${name}`;

export type MissingRecipe = { menu: number; dish: string; file: string };

/** Every dish whose recipe file is not among the known ones, with its menu. */
export function missingRecipes(menus: WeeklyMenu[], knownFiles: ReadonlySet<string>): MissingRecipe[] {
  return menus.flatMap(({ number, meals }) =>
    meals.flatMap(({ dishes }) =>
      dishes
        .filter(({ recipeFile }) => recipeFile !== null && !knownFiles.has(recipeFile))
        .map(({ name, recipeFile }) => ({ menu: number, dish: name, file: recipeFile! })),
    ),
  );
}

/** The text of a recipe row that is embedded: its title and ingredient names, never the preparation. */
export type EmbeddingDocument = { title: string; content: string };

export function embeddingDocument(title: string, ingredientNames: string[]): EmbeddingDocument {
  return { title, content: ingredientNames.length > 0 ? ingredientNames.join(", ") : title };
}

/** What an embedding was computed from: the same source means the embedding can be kept. */
export const embeddingSource = ({ title, content }: EmbeddingDocument): string => `${title}\n${content}`;
