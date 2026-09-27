import type { MealType } from "@/domain/menu/weekly-menu";
import type { SourceMenu } from "@/domain/menu-ingestion/source-menu";
import type { Result } from "@/shared/result";

/** A menu folder of the source, with the number taken from its name. */
export type MenuFolder = { number: number; name: string };

export type SourceError =
  | { kind: "missing-raw-directory"; path: string }
  | { kind: "missing-file"; file: string }
  | { kind: "unreadable-document"; reason: string }
  | { kind: "no-table" }
  | { kind: "missing-header" }
  | { kind: "missing-meal-row"; meal: MealType };

/** Where the nutritionist's menus and recipe files are read from. */
export interface DocumentSource {
  /** The menu folders; fails when the source itself is missing. */
  listMenuFolders(): Promise<Result<MenuFolder[], SourceError>>;
  /** The menu as the source reads it, with its layout already removed. */
  readMenu(folder: MenuFolder): Promise<Result<SourceMenu, SourceError>>;
  /** Base names of the folder's recipe documents, without extension and deduplicated. */
  listRecipeFiles(folder: MenuFolder): Promise<string[]>;
}
