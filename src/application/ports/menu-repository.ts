import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { Result } from "@/shared/result";
import type { RepositoryError } from "@/application/ports/repository-error";


export interface MenuRepository {
  /** Stores the given menus. It must not remove menus it did not receive. */
  saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>>;
}
