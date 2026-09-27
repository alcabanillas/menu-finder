import type { MealType } from "@/domain/menu/weekly-menu";
import type { SourceMenu } from "@/domain/menu-ingestion/source-menu";
import type { RecipeContent } from "@/domain/recipe/recipe";
import type { Result } from "@/shared/result";

/** A menu folder of the source, with the number taken from its name. */
export type MenuFolder = { number: number; name: string };

export type SourceError =
  | { kind: "missing-raw-directory"; path: string }
  | { kind: "missing-file"; file: string }
  | { kind: "unreadable-document"; reason: string }
  | { kind: "no-table" }
  | { kind: "missing-header" }
  | { kind: "missing-meal-row"; meal: MealType }
  | { kind: "missing-section"; section: "ingredients" };

/** Something in a recipe document's layout that the reader could not place; the recipe is still read. */
export type LayoutAnomaly =
  | { kind: "missing-times-section" }
  | { kind: "missing-closing-line" }
  | { kind: "missing-preparation-section" }
  | { kind: "unknown-time-label"; text: string }
  | { kind: "invalid-time"; label: string; text: string }
  | { kind: "text-before-first-ingredient"; text: string }
  | { kind: "amount-without-ingredient"; text: string }
  | { kind: "name-without-colon"; text: string }
  | { kind: "ingredient-without-amount"; text: string }
  | { kind: "unrecognized-amount"; text: string }
  | { kind: "unexpected-second-page-text"; text: string };

/** A recipe as the source reads it, with the anomalies found in its layout. */
export type SourceRecipe = { content: RecipeContent; anomalies: LayoutAnomaly[] };

/** Where the nutritionist's menus and recipe files are read from. */
export interface DocumentSource {
  /** The menu folders; fails when the source itself is missing. */
  listMenuFolders(): Promise<Result<MenuFolder[], SourceError>>;
  /** The menu as the source reads it, with its layout already removed. */
  readMenu(folder: MenuFolder): Promise<Result<SourceMenu, SourceError>>;
  /** Base names of the folder's recipe documents, without extension and deduplicated. */
  listRecipeFiles(folder: MenuFolder): Promise<string[]>;
  /** One recipe document of the folder, by the base name `listRecipeFiles` returned. */
  readRecipe(folder: MenuFolder, file: string): Promise<Result<SourceRecipe, SourceError>>;
}
