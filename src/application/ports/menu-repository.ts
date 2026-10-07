import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Result } from '@/shared/result';
import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';

export interface MenuRepository {
  /** Stores the given menus. It must not remove menus it did not receive. */
  saveAll(menus: WeeklyMenu[]): Promise<Result<void, RepositoryError>>;
  /** Every stored menu, ordered by number. */
  list(): Promise<Result<WeeklyMenu[], RepositoryReadError>>;
  /** The stored menu with that number, or `null` when there is none. */
  find(number: number): Promise<Result<WeeklyMenu | null, RepositoryReadError>>;
}
