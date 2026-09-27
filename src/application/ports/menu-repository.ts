import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { Result } from "@/shared/result";

export type RepositoryError = { kind: "write-failed"; reason: string };

export interface MenuRepository {
  /** Stores the given menus. It must not remove menus it did not receive. */
  saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>>;
}
