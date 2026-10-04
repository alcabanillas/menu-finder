import type { RepositoryError } from '@/application/ports/repository-error';
import type { ShoppingList } from '@/domain/shopping/shopping-list';
import type { Result } from '@/shared/result';

export interface ShoppingListRepository {
  saveAll(lists: ShoppingList[]): Promise<Result<void, RepositoryError>>;
}
