import type { Unit } from '@/domain/recipe/recipe';

export type ShoppingItem = {
  category: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

/** An item as stored: its position, from 1, is its order in the PDF and stays the same when the same PDF is loaded again. */
export type StoredShoppingItem = ShoppingItem & { position: number };

export type ShoppingList = {
  menuNumber: number;
  items: ShoppingItem[];
};
