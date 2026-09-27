import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFParse } from "pdf-parse";
import type { DocumentSource, MenuFolder, SourceError } from "@/application/ports/document-source";
import type { SourceMenu } from "@/domain/menu-ingestion/source-menu";
import { err, ok, type Result } from "@/shared/result";
import { toSourceMenu } from "./pdf/menu-table";

const MENU_FOLDER = /^Menu (\d+)$/;
const MENU_FILE = "menu.pdf";
const RECIPE_EXTENSION = ".pdf";
/** Documents in a menu folder that are not recipes. */
const NON_RECIPE_FILES = /^(menu|lista_de_la_compra|valoracion.*)$/i;

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

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
      return err({ kind: "unreadable-document", reason: errorMessage(error) });
    }

    let table: string[][] | undefined;
    const parser = new PDFParse({ data });
    try {
      // The weekly menu is the first table of the first page.
      table = (await parser.getTable()).pages[0]?.tables[0];
    } catch (error) {
      return err({ kind: "unreadable-document", reason: errorMessage(error) });
    } finally {
      await parser.destroy();
    }

    return table ? toSourceMenu(table) : err({ kind: "no-table" });
  }
}
