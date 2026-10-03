import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RepositoryError } from '@/application/ports/repository-error';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok, type Result } from '@/shared/result';

export const MENU_DATASET_FILE = 'menu-platos.json';

/**
 * The menus serialized as they are to `<dataDir>/menu-platos.json`, rewritten
 * whole on every save. Written before the database (MF-41 design D1), for the
 * golden-set scripts and for working without the database.
 */
export class JsonFileMenuRepository implements MenuRepository {
  constructor(private readonly dataDir: string) {}

  async saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>> {
    try {
      await writeFile(join(this.dataDir, MENU_DATASET_FILE), `${JSON.stringify(menus, null, 2)}\n`, 'utf8');
      return ok(undefined);
    } catch (error) {
      return err({ kind: 'write-failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }
}
