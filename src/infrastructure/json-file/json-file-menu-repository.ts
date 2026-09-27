import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MenuRepository, RepositoryError } from "@/application/ports/menu-repository";
import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import { err, ok, type Result } from "@/shared/result";

export const MENU_DATASET_FILE = "menu-platos.json";

/**
 * Temporary menu store: the menus serialized as they are to
 * `<dataDir>/menu-platos.json`, rewritten whole on every save. MF-16 replaces
 * it with a database adapter, which must upsert per menu instead.
 */
export class JsonFileMenuRepository implements MenuRepository {
  constructor(private readonly dataDir: string) {}

  async saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>> {
    try {
      await writeFile(join(this.dataDir, MENU_DATASET_FILE), `${JSON.stringify(menus, null, 2)}\n`, "utf8");
      return ok(undefined);
    } catch (error) {
      return err({ kind: "write-failed", reason: error instanceof Error ? error.message : String(error) });
    }
  }
}
