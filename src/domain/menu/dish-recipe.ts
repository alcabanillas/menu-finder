import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';

/** Key of the recipe row of a dish without recipe file: one row per distinct dish name. */
const NAME_ONLY_PREFIX = 'dish:';

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
