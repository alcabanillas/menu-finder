import type { StoredShoppingItem } from '@/domain/shopping/shopping-list';

type ChecklistItem = StoredShoppingItem & { checked: boolean };

/** The items of one category, in position order, and how many of them are ticked. */
type ChecklistCategory = { name: string; items: ChecklistItem[]; checkedCount: number };

/** A shopping list with its ticks: categories in the order of their first item, and the counts over every item. */
export type Checklist = { categories: ChecklistCategory[]; checkedCount: number; total: number };

/** The list grouped by category with the ticked positions marked; ticked positions not in the list are ignored. */
export function toChecklist(items: StoredShoppingItem[], checkedPositions: number[]): Checklist {
  const ticked = new Set(checkedPositions);
  const marked = [...items].sort(byPosition).map((item) => ({ ...item, checked: ticked.has(item.position) }));
  const categories = groupByCategory(marked);
  return { categories, checkedCount: marked.filter((item) => item.checked).length, total: marked.length };
}

function groupByCategory(items: ChecklistItem[]): ChecklistCategory[] {
  const byName = new Map<string, ChecklistItem[]>();
  for (const item of items) byName.set(item.category, [...(byName.get(item.category) ?? []), item]);
  return [...byName].map(([name, categoryItems]) => ({
    name,
    items: categoryItems,
    checkedCount: categoryItems.filter((item) => item.checked).length,
  }));
}

function byPosition(a: StoredShoppingItem, b: StoredShoppingItem): number {
  return a.position - b.position;
}
