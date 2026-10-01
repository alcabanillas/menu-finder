import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { DatasetFile, DatasetSource, DatasetSourceError } from "@/application/ports/dataset-source";
import { err, ok, type Result } from "@/shared/result";
import { MENU_DATASET_FILE } from "./json-file-menu-repository";
import { RECIPE_DATASET_FILE } from "./json-file-recipe-repository";

const isMissing = (error: unknown) => (error as { code?: unknown } | null)?.code === "ENOENT";

/** The dataset files written by `pnpm ingest menu` and `pnpm ingest recipes` in `data/`. */
export class JsonFileDatasetSource implements DatasetSource {
  constructor(private readonly dataDir: string) {}

  readMenus(): Promise<Result<DatasetFile, DatasetSourceError>> {
    return this.read(MENU_DATASET_FILE, "pnpm ingest menu");
  }

  readRecipes(): Promise<Result<DatasetFile, DatasetSourceError>> {
    return this.read(RECIPE_DATASET_FILE, "pnpm ingest recipes");
  }

  private async read(file: string, command: string): Promise<Result<DatasetFile, DatasetSourceError>> {
    let text: string;
    try {
      text = await readFile(join(this.dataDir, file), "utf8");
    } catch (error) {
      if (isMissing(error)) return err({ kind: "missing-file", file, command });
      throw error;
    }
    try {
      return ok({ file, content: JSON.parse(text) as unknown });
    } catch (error) {
      return err({ kind: "invalid-json", file, reason: error instanceof Error ? error.message : String(error) });
    }
  }
}
