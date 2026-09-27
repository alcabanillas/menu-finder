import type { Recipe, RecipeContent } from "@/domain/recipe/recipe";

/** One recipe file as read from one menu folder. */
export type RecipeVersion = { menu: number; file: string; content: RecipeContent };

export type RecipeField = "title" | "times" | "ingredients" | "preparation";

const FIELDS: RecipeField[] = ["title", "times", "ingredients", "preparation"];

/** A file whose versions differ from the kept one. */
export type DivergentRecipe = { file: string; keptMenu: number; differingMenus: number[]; fields: RecipeField[] };

export type VersionSelection = {
  /** One per file, sorted by file name. */
  recipes: Recipe[];
  /** Files read from two or more menus. */
  repeatedFiles: number;
  divergent: DivergentRecipe[];
};

// The contents are plain data built in the same key order, so their JSON is a structural comparison.
const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// File names are unique map keys, so two of them are never equal.
const byFileName = ([a]: [string, RecipeVersion[]], [b]: [string, RecipeVersion[]]): number => (a < b ? -1 : 1);

/**
 * Keeps one recipe per file: the version from the highest-numbered menu. The
 * other versions are compared with it, field by field, to report the files
 * whose versions differ.
 */
export function selectRecipeVersions(versions: RecipeVersion[]): VersionSelection {
  const byFile = new Map<string, RecipeVersion[]>();
  for (const version of versions) byFile.set(version.file, [...(byFile.get(version.file) ?? []), version]);

  const recipes: Recipe[] = [];
  const divergent: DivergentRecipe[] = [];
  let repeatedFiles = 0;

  for (const [file, fileVersions] of [...byFile.entries()].sort(byFileName)) {
    const [kept, ...others] = [...fileVersions].sort((a, b) => b.menu - a.menu);
    recipes.push({ file, sourceMenu: kept.menu, ...kept.content });
    if (others.length === 0) continue;
    repeatedFiles++;

    const differing = others
      .map((other) => ({
        menu: other.menu,
        fields: FIELDS.filter((field) => !sameValue(other.content[field], kept.content[field])),
      }))
      .filter(({ fields }) => fields.length > 0);
    if (differing.length === 0) continue;

    divergent.push({
      file,
      keptMenu: kept.menu,
      differingMenus: differing.map(({ menu }) => menu).sort((a, b) => a - b),
      fields: FIELDS.filter((field) => differing.some(({ fields }) => fields.includes(field))),
    });
  }

  return { recipes, repeatedFiles, divergent };
}
