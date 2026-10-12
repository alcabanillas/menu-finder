import type { MealType } from '@/domain/menu/weekly-menu';
import type { SourceMenu } from '@/domain/menu/source-menu';
import type { LayoutAnomaly } from '@/domain/recipe/layout-anomalies';
import type { RecipeContent } from '@/domain/recipe/recipe';
import type { ShoppingListAnomaly } from '@/domain/shopping/shopping-list-anomalies';
import type { ShoppingItem } from '@/domain/shopping/shopping-list';
import type { Result } from '@/shared/result';

/** A menu folder of the source, with the number taken from its name. */
export type MenuFolder = { number: number; name: string };

export type SourceError =
  | { kind: 'missing-raw-directory'; path: string }
  | { kind: 'missing-file'; file: string }
  | { kind: 'unreadable-document'; reason: string }
  | { kind: 'no-table' }
  | { kind: 'missing-header' }
  | { kind: 'missing-meal-row'; meal: MealType }
  | { kind: 'missing-section'; section: 'ingredients' };

/** A recipe as the source reads it, with the anomalies found in its layout. */
export type SourceRecipe = { content: RecipeContent; anomalies: LayoutAnomaly[] };

/** A shopping list as the source reads it, with page count and anomalies found in its layout. */
export type SourceShoppingList = {
  pages: number;
  items: ShoppingItem[];
  anomalies: ShoppingListAnomaly[];
};

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
  /** One shopping list document of the folder (`Lista_de_la_compra.pdf`). */
  readShoppingList(folder: MenuFolder): Promise<Result<SourceShoppingList, SourceError>>;
}
