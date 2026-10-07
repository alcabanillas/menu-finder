import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import { shoppingChecklist } from '@/application/use-cases/shopping-checklist';
import type { LocalDate } from '@/domain/selection/local-date';
import type { StoredShoppingItem } from '@/domain/shopping/shopping-list';
import { err, ok } from '@/shared/result';

type Row = { userId: string; id: string; menuNumber: number; startsOn: LocalDate };
type Failing = 'none' | 'selections' | 'items' | 'ticks';

const ANA = 'user-a';
const BEA = 'user-b';

const fixedClock = (today: LocalDate): Clock => ({ today: () => today });

const row = (userId: string, id: string, menuNumber: number, startsOn: LocalDate): Row => ({
  userId,
  id,
  menuNumber,
  startsOn,
});

const item = (position: number, category: string, name: string, quantity: number | null, unit: 'g' | 'ml' | null, optional = false): StoredShoppingItem => ({
  position,
  category,
  name,
  quantity,
  unit,
  optional,
});

const MENU_9101 = [
  item(1, 'Legumbres', 'Garbanzos cocidos', 400, 'g'),
  item(2, 'Legumbres', 'Piñones', 20, 'g', true),
  item(3, 'Lácteos', 'Leche', 1000, 'ml'),
];

function setup(rows: Row[], ticks: Record<string, number[]> = {}, failing: Failing = 'none') {
  const tickRequests: Array<{ userId: string; selectionId: string }> = [];
  const selections: SelectionRepository = {
    listFrom: async (userId, from) => {
      if (failing === 'selections') return err({ kind: 'read-failed', reason: 'down' });
      return ok(
        rows
          .filter((r) => r.userId === userId && r.startsOn >= from)
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
          .map(({ id, menuNumber, startsOn }) => ({ id, menuNumber, startsOn })),
      );
    },
    replace: async () => err({ kind: 'write-failed', reason: 'not used' }),
    checkedPositions: async (userId, selectionId) => {
      tickRequests.push({ userId, selectionId });
      if (failing === 'ticks') return err({ kind: 'read-failed', reason: 'down' });
      const owned = rows.some((r) => r.userId === userId && r.id === selectionId);
      return ok(owned ? (ticks[selectionId] ?? []) : []);
    },
    setChecked: async () => err({ kind: 'write-failed', reason: 'not used' }),
  };
  const shoppingLists: ShoppingListRepository = {
    saveAll: async () => err({ kind: 'write-failed', reason: 'not used' }),
    find: async (menuNumber) => {
      if (failing === 'items') return err({ kind: 'read-failed', reason: 'down' });
      return ok(menuNumber === 9101 ? MENU_9101 : []);
    },
  };
  return { selections, shoppingLists, tickRequests };
}

describe('shoppingChecklist', () => {
  it('shows a current list with items, grouped, with its menu and Monday', async () => {
    const fake = setup([row(ANA, 'sel-1', 9101, '2026-10-05')], { 'sel-1': [1] });

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(
      ok({
        menuNumber: 9101,
        startsOn: '2026-10-05',
        checkedCount: 1,
        total: 3,
        categories: [
          {
            name: 'Legumbres',
            checkedCount: 1,
            items: [
              { position: 1, name: 'Garbanzos cocidos', quantity: 400, unit: 'g', optional: false, checked: true },
              { position: 2, name: 'Piñones', quantity: 20, unit: 'g', optional: true, checked: false },
            ],
          },
          {
            name: 'Lácteos',
            checkedCount: 0,
            items: [{ position: 3, name: 'Leche', quantity: 1000, unit: 'ml', optional: false, checked: false }],
          },
        ],
      }),
    );
  });

  it('takes next week’s list as the current one', async () => {
    const fake = setup([row(ANA, 'sel-3', 3, '2026-10-05'), row(ANA, 'sel-12', 9101, '2026-10-12')]);

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-09') }, { userId: ANA });

    expect(result.ok && result.value?.menuNumber).toBe(9101);
    expect(result.ok && result.value?.startsOn).toBe('2026-10-12');
  });

  it('gives null when the user has no current shopping list', async () => {
    const fake = setup([row(BEA, 'sel-1', 9101, '2026-10-05')]);

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(ok(null));
    expect(fake.tickRequests).toEqual([]);
  });

  it('gives a checklist with total 0 when the menu has no stored list', async () => {
    const fake = setup([row(ANA, 'sel-1', 77, '2026-10-05')]);

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(ok({ menuNumber: 77, startsOn: '2026-10-05', checkedCount: 0, total: 0, categories: [] }));
  });

  it.each([['selections'], ['items'], ['ticks']] as const)('fails when reading the %s fails', async (failing) => {
    const fake = setup([row(ANA, 'sel-1', 9101, '2026-10-05')], {}, failing);

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(err({ kind: 'failed' }));
  });

  it('asks for the ticks of the session’s user only, so another user’s ticks are invisible', async () => {
    const fake = setup([row(ANA, 'sel-a', 9101, '2026-10-05'), row(BEA, 'sel-b', 9101, '2026-10-05')], {
      'sel-a': [1, 2, 3],
    });

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-07') }, { userId: BEA });

    expect(fake.tickRequests).toEqual([{ userId: BEA, selectionId: 'sel-b' }]);
    expect(result.ok && result.value?.checkedCount).toBe(0);
  });

  it('asks for the ticks by the current selection’s id, so the same menu another week starts unticked', async () => {
    const fake = setup([row(ANA, 'sel-old', 9101, '2026-10-05'), row(ANA, 'sel-new', 9101, '2026-10-12')], {
      'sel-old': [1, 2],
    });

    const result = await shoppingChecklist({ ...fake, clock: fixedClock('2026-10-09') }, { userId: ANA });

    expect(fake.tickRequests).toEqual([{ userId: ANA, selectionId: 'sel-new' }]);
    expect(result.ok && result.value?.checkedCount).toBe(0);
  });
});
