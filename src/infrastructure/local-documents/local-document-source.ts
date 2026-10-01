import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFParse } from "pdf-parse";
import type { DocumentSource, MenuFolder, SourceError, SourceRecipe } from "@/application/ports/document-source";
import type { SourceMenu } from "@/domain/menu-ingestion/source-menu";
import { err, ok, type Result } from "@/shared/result";
import { toSourceMenu } from "@/infrastructure/local-documents/pdf/menu-table";
import { parseRecipePage, type PositionedText } from "@/infrastructure/local-documents/pdf/recipe-page";

const MENU_FOLDER = /^Menu (\d+)$/;
const MENU_FILE = "menu.pdf";
const RECIPE_EXTENSION = ".pdf";
/** Documents in a menu folder that are not recipes. */
const NON_RECIPE_FILES = /^(menu|lista_de_la_compra|valoracion.*)$/i;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const unreadable = (error: unknown): Result<never, SourceError> =>
  err({ kind: "unreadable-document", reason: errorMessage(error) });

const isNotFound = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

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
      return err({ kind: "missing-raw-directory", path: this.rawDir });
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
      if (isNotFound(error)) return err({ kind: "missing-file", file: MENU_FILE });
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

    return table ? toSourceMenu(table) : err({ kind: "no-table" });
  }

  async readRecipe(folder: MenuFolder, file: string): Promise<Result<SourceRecipe, SourceError>> {
    const fileName = `${file}${RECIPE_EXTENSION}`;
    let data: Buffer;
    try {
      data = await readFile(join(this.rawDir, folder.name, fileName));
    } catch (error) {
      if (isNotFound(error)) return err({ kind: "missing-file", file: fileName });
      return unreadable(error);
    }

    let pages: PositionedText[][];
    try {
      pages = await readPositionedText(data, 2);
    } catch (error) {
      return unreadable(error);
    }
    return parseRecipePage(pages[0] ?? [], pages[1] ?? null);
  }
}

/** The text items of the first `maxPages` pages, with their position. */
async function readPositionedText(data: Buffer, maxPages: number): Promise<PositionedText[][]> {
  // pdfjs-dist is ESM-only and heavy: loaded only when a recipe is read.
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await getDocument({ data: new Uint8Array(data), verbosity: 0 }).promise;
  try {
    const pages: PositionedText[][] = [];
    for (let number = 1; number <= Math.min(document.numPages, maxPages); number++) {
      const { items } = await (await document.getPage(number)).getTextContent();
      pages.push(
        items.flatMap((item) =>
          "str" in item ? [{ x: item.transform[4] as number, y: item.transform[5] as number, text: item.str }] : [],
        ),
      );
    }
    return pages;
  } finally {
    await document.destroy();
  }
}
