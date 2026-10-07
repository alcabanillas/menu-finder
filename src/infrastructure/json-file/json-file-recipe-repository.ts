import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { Recipe } from '@/domain/recipe/recipe';
import { err, ok, type Result } from '@/shared/result';

export const RECIPE_DATASET_FILE = 'recetas.json';

/**
 * The recipes serialized as they are to `<dataDir>/recetas.json`, rewritten
 * whole on every save. Written before the database (MF-41 design D1), for the
 * golden-set scripts and for working without the database.
 */
export class JsonFileRecipeRepository implements RecipeRepository {
  constructor(private readonly dataDir: string) {}

  async saveAll(recipes: Recipe[]): Promise<Result<void, RepositoryError>> {
    try {
      await writeFile(join(this.dataDir, RECIPE_DATASET_FILE), `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
      return ok(undefined);
    } catch (error) {
      return err({ kind: 'write-failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }

  /** The recipes of the files asked for. The file is the one `saveAll` writes, so its shape is trusted. */
  async findByFiles(files: string[]): Promise<Result<Recipe[], RepositoryReadError>> {
    try {
      const recipes = JSON.parse(await readFile(join(this.dataDir, RECIPE_DATASET_FILE), 'utf8')) as Recipe[];
      const wanted = new Set(files);
      return ok(recipes.filter(({ file }) => wanted.has(file)));
    } catch (error) {
      return err({ kind: 'read-failed', reason: error instanceof Error ? error.message : String(error) });
    }
  }
}
