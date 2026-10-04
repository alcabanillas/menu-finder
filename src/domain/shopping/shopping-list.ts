import type { Unit } from '@/domain/recipe/recipe';

export type ShoppingItem = {
  category: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  optional: boolean;
};

export type ShoppingList = {
  menuNumber: number;
  items: ShoppingItem[];
};
