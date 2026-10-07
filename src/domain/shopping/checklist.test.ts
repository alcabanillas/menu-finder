import { describe, expect, it } from 'vitest';
import { toChecklist } from '@/domain/shopping/checklist';
import type { StoredShoppingItem } from '@/domain/shopping/shopping-list';

const item = (position: number, category: string, name: string): StoredShoppingItem => ({
  position,
  category,
  name,
  quantity: null,
  unit: null,
  optional: false,
});

const ITEMS = [
  item(1, 'Legumbres', 'Garbanzos cocidos'),
  item(2, 'Lácteos', 'Leche'),
  item(3, 'Legumbres', 'Piñones'),
];

describe('toChecklist', () => {
  it('orders categories by their first item and items by position', () => {
    const checklist = toChecklist([ITEMS[2], ITEMS[1], ITEMS[0]], []);

    expect(checklist.categories.map((category) => category.name)).toEqual(['Legumbres', 'Lácteos']);
    expect(checklist.categories[0].items.map((i) => i.position)).toEqual([1, 3]);
  });

  it('marks the ticked positions', () => {
    const checklist = toChecklist(ITEMS, [3, 2]);

    expect(checklist.categories.flatMap((c) => c.items).map((i) => [i.position, i.checked])).toEqual([
      [1, false],
      [3, true],
      [2, true],
    ]);
  });

  it('counts the ticked items per category and in total', () => {
    const checklist = toChecklist(ITEMS, [1, 2]);

    expect(checklist.categories.map((c) => c.checkedCount)).toEqual([1, 1]);
    expect(checklist.checkedCount).toBe(2);
    expect(checklist.total).toBe(3);
  });

  it('ignores ticked positions that are not in the list', () => {
    const checklist = toChecklist(ITEMS, [4, 99]);

    expect(checklist.checkedCount).toBe(0);
    expect(checklist.total).toBe(3);
  });

  it('gives total 0 for an empty list', () => {
    expect(toChecklist([], [1])).toEqual({ categories: [], checkedCount: 0, total: 0 });
  });
});
