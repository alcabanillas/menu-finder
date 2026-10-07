/** An item of the checklist as the web shows it. `unit` is `null` for a count or an item without quantity. */
export type ShoppingChecklistItemDto = {
  position: number;
  name: string;
  quantity: number | null;
  unit: string | null;
  optional: boolean;
  checked: boolean;
};

export type ShoppingChecklistCategoryDto = { name: string; checkedCount: number; items: ShoppingChecklistItemDto[] };

/** The current shopping list with its ticks: the menu, its Monday (`YYYY-MM-DD`) and the categories in list order. */
export type ShoppingChecklistDto = {
  menuNumber: number;
  startsOn: string;
  checkedCount: number;
  total: number;
  categories: ShoppingChecklistCategoryDto[];
};
