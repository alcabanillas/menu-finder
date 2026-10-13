import {
  checkShoppingItems,
  type CheckShoppingItemsInput,
} from '@/application/use-cases/shopping-list/check-shopping-items';
import {
  shoppingChecklist,
  type ShoppingChecklistInput,
} from '@/application/use-cases/shopping-list/shopping-checklist';
import type { Deps } from './infrastructure-deps';

/** The use cases of the shopping list. */
export function shoppingUseCases(lazyDeps: () => Deps) {
  return {
    shoppingChecklist: async (input: ShoppingChecklistInput) => shoppingChecklist(lazyDeps(), input),
    checkShoppingItems: async (input: CheckShoppingItemsInput) => checkShoppingItems(lazyDeps(), input),
  };
}
