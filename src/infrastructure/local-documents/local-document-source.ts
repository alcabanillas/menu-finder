import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFParse } from 'pdf-parse';
import type { DocumentSource, MenuFolder, SourceError, SourceRecipe, SourceShoppingList } from '@/application/ports/document-source';
import type { SourceMenu } from '@/domain/menu/source-menu';
import { err, ok, type Result } from '@/shared/result';
import { toSourceMenu } from '@/infrastructure/local-documents/pdf/menu-table';
import { readPositionedText, type PositionedText } from '@/infrastructure/local-documents/pdf/positioned-text';
import { parseRecipePage } from '@/infrastructure/local-documents/pdf/recipe-page';
import { parseShoppingListPage } from '@/infrastructure/local-documents/pdf/shopping-list-page';

const MENU_FOLDER = /^Menu (\d+)$/;
const MENU_FILE = 'menu.pdf';
const SHOPPING_LIST_FILE = 'Lista_de_la_compra.pdf';
const RECIPE_EXTENSION = '.pdf';
/** Documents in a menu folder that are not recipes. */
const NON_RECIPE_FILES = /^(menu|lista_de_la_compra|valoracion.*)$/i;

/** Reads the menus and recipe files from the local `data/raw/Dieta` folders. */
export class LocalDocumentSource implements DocumentSource {
  constructor(private readonly rawDir: string) {}

  async listMenuFolders(): Promise<Result<MenuFolder[], SourceError>> {
    try {
      const entries = await readdir(this.rawDir, { withFileTypes: true });
      return ok(
        entries.flatMap((entry) => {
          const match = entry.isDirectory() ? MENU_FOLDER.exec(entry.name) : null;
          return match ? [{ number: Number(match[1]), name: entry.name }] : [];
        }),
      );
    } catch {
      return err({ kind: 'missing-raw-directory', path: this.rawDir });
    }
  }

  async listRecipeFiles(folder: MenuFolder): Promise<string[]> {
    const files = await readdir(join(this.rawDir, folder.name));
    return files
      .filter((file) => file.endsWith(RECIPE_EXTENSION))
      .map((file) => file.slice(0, -RECIPE_EXTENSION.length))
      .filter((name) => !NON_RECIPE_FILES.test(name));
  }

  async readMenu(folder: MenuFolder): Promise<Result<SourceMenu, SourceError>> {
    let data: Buffer;
    try {
      data = await readFile(join(this.rawDir, folder.name, MENU_FILE));
    } catch (error) {
      if (isNotFound(error)) return missingFile(MENU_FILE);
      return unreadable(error);
    }

    let table: string[][] | undefined;
    const parser = new PDFParse({ data });
    try {
      // The weekly menu is the first table of the first page.
      table = (await parser.getTable()).pages[0]?.tables[0];
    } catch (error) {
      return unreadable(error);
    } finally {
      await parser.destroy();
    }

    return table ? toSourceMenu(table) : err({ kind: 'no-table' });
  }

  async readRecipe(folder: MenuFolder, file: string): Promise<Result<SourceRecipe, SourceError>> {
    const fileName = `${file}${RECIPE_EXTENSION}`;
    let data: Buffer;
    try {
      data = await readFile(join(this.rawDir, folder.name, fileName));
    } catch (error) {
      if (isNotFound(error)) return missingFile(fileName);
      return unreadable(error);
    }

    let pages: PositionedText[][];
    try {
      pages = await readPositionedText(data, { maxPages: 2 });
    } catch (error) {
      return unreadable(error);
    }
    return parseRecipePage(pages[0] ?? [], pages[1] ?? null);
  }

  async readShoppingList(folder: MenuFolder): Promise<Result<SourceShoppingList, SourceError>> {
    let fileName = SHOPPING_LIST_FILE;
    try {
      const files = await readdir(join(this.rawDir, folder.name));
      const found = files.find((f) => f.toLowerCase() === SHOPPING_LIST_FILE.toLowerCase());
      if (found) fileName = found;
    } catch {
      // Missing directory or error reading folder handled by readFile below
    }

    let data: Buffer;
    try {
      data = await readFile(join(this.rawDir, folder.name, fileName));
    } catch (error) {
      if (isNotFound(error)) return missingFile(SHOPPING_LIST_FILE);
      return unreadable(error);
    }

    let pages: PositionedText[][];
    try {
      pages = await readPositionedText(data);
    } catch (error) {
      return unreadable(error);
    }
    return ok(parseShoppingListPage(pages));
  }
}

function missingFile(file: string): Result<never, SourceError> {
  return err({ kind: 'missing-file', file });
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function unreadable(error: unknown): Result<never, SourceError> {
  return err({ kind: 'unreadable-document', reason: errorMessage(error) });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
