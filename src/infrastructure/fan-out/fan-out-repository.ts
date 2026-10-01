import type { RepositoryError } from "@/application/ports/repository-error";
import { err, ok, type Result } from "@/shared/result";

/** The shape `MenuRepository` and `RecipeRepository` share. */
type SaveAll<T> = { saveAll(items: T[]): Promise<Result<void, RepositoryError>> };

/**
 * Saves to the JSON file and then to the database (MF-41 design D1), so the
 * ingestion use cases still receive one repository. The file goes first: it
 * is what the golden-set scripts read, and it almost never fails.
 */
export class FanOutRepository<T> implements SaveAll<T> {
  constructor(
    private readonly file: SaveAll<T>,
    private readonly database: SaveAll<T>,
    /** How the file is named in the error, e.g. `data/menu-platos.json`. */
    private readonly fileName: string,
  ) {}

  async saveAll(items: T[]): Promise<Result<void, RepositoryError>> {
    const written = await this.file.saveAll(items);
    if (!written.ok) return written;
    const saved = await this.database.saveAll(items);
    if (saved.ok) return ok(undefined);
    return err({
      kind: "write-failed",
      reason: `${this.fileName} was written, but the database save failed: ${saved.error.reason}`,
    });
  }
}
