import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import type { ShoppingList, StoredShoppingItem } from '@/domain/shopping/shopping-list';
import type { Result } from '@/shared/result';

export interface ShoppingListRepository {
  saveAll(lists: ShoppingList[]): Promise<Result<void, RepositoryError>>;
  /** The items of the menu's list ordered by position; empty when the menu has no stored list. */
  find(menuNumber: number): Promise<Result<StoredShoppingItem[], RepositoryReadError>>;
}
