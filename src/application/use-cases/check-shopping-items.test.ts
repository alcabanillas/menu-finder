import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { ShoppingListRepository } from '@/application/ports/shopping-list-repository';
import { checkShoppingItems } from '@/application/use-cases/check-shopping-items';
import type { LocalDate } from '@/domain/selection/local-date';
import type { StoredShoppingItem } from '@/domain/shopping/shopping-list';
import { err, ok } from '@/shared/result';

type Row = { userId: string; id: string; menuNumber: number; startsOn: LocalDate };
type Failing = 'none' | 'selections' | 'items' | 'write';
type Call = { userId: string; selectionId: string; positions: number[]; checked: boolean };

const ANA = 'user-a';
const BEA = 'user-b';
const TODAY: LocalDate = '2026-10-07';

const fixedClock = (today: LocalDate): Clock => ({ today: () => today });

const row = (userId: string, id: string, menuNumber: number, startsOn: LocalDate): Row => ({
  userId,
  id,
  menuNumber,
  startsOn,
});

const item = (position: number, category: string): StoredShoppingItem => ({
  position,
  category,
  name: `Item ${position}`,
  quantity: null,
  unit: null,
  optional: false,
});

const MENU_9101 = [item(1, 'Legumbres'), item(2, 'Legumbres'), item(3, 'Lácteos')];

function setup(rows: Row[], failing: Failing = 'none') {
  const calls: Call[] = [];
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
    checkedPositions: async () => err({ kind: 'read-failed', reason: 'not used' }),
    setChecked: async (userId, selectionId, positions, checked) => {
      calls.push({ userId, selectionId, positions, checked });
      if (failing === 'write') return err({ kind: 'write-failed', reason: 'down' });
      return ok(undefined);
    },
  };
  const shoppingLists: ShoppingListRepository = {
    saveAll: async () => err({ kind: 'write-failed', reason: 'not used' }),
    find: async (menuNumber) => {
      if (failing === 'items') return err({ kind: 'read-failed', reason: 'down' });
      return ok(menuNumber === 9101 ? MENU_9101 : []);
    },
  };
  return { selections, shoppingLists, calls };
}

const current = () => [row(ANA, 'sel-1', 9101, '2026-10-05')];
const run = (fake: ReturnType<typeof setup>, input: Parameters<typeof checkShoppingItems>[1]) =>
  checkShoppingItems({ selections: fake.selections, shoppingLists: fake.shoppingLists, clock: fixedClock(TODAY) }, input);

describe('checkShoppingItems', () => {
  it('ticks an item of the current list', async () => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked: true });

    expect(result).toEqual(ok(undefined));
    expect(fake.calls).toEqual([{ userId: ANA, selectionId: 'sel-1', positions: [1], checked: true }]);
  });

  it('unticks an item', async () => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked: false });

    expect(result).toEqual(ok(undefined));
    expect(fake.calls).toEqual([{ userId: ANA, selectionId: 'sel-1', positions: [1], checked: false }]);
  });

  it('accepts what a form sends: strings for the menu, the positions and the tick', async () => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: '9101', positions: ['2', '3'], checked: 'true' });

    expect(result).toEqual(ok(undefined));
    expect(fake.calls).toEqual([{ userId: ANA, selectionId: 'sel-1', positions: [2, 3], checked: true }]);
  });

  it('accepts the tick value "false" as a string', async () => {
    const fake = setup(current());

    await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked: 'false' });

    expect(fake.calls[0].checked).toBe(false);
  });

  it('sends a repeated position once, so ticking twice is the same as ticking once', async () => {
    const fake = setup(current());

    await run(fake, { userId: ANA, menuNumber: 9101, positions: ['1', 1, '1'], checked: true });

    expect(fake.calls[0].positions).toEqual([1]);
  });

  it('ticks several positions at once, as a category does', async () => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1, 2], checked: true });

    expect(result).toEqual(ok(undefined));
    expect(fake.calls).toEqual([{ userId: ANA, selectionId: 'sel-1', positions: [1, 2], checked: true }]);
  });

  it.each([['2abc'], [0], [-1], [1.5], ['1.5'], [''], ['٣'], [Number.MAX_SAFE_INTEGER + 1]])(
    'refuses the position %j as invalid',
    async (position) => {
      const fake = setup(current());

      const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [position], checked: true });

      expect(result).toEqual(err({ kind: 'invalid' }));
      expect(fake.calls).toEqual([]);
    },
  );

  it.each([[undefined], [null], [[]], ['1'], [1]])('refuses the positions %j as invalid', async (positions) => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions, checked: true });

    expect(result).toEqual(err({ kind: 'invalid' }));
    expect(fake.calls).toEqual([]);
  });

  it('refuses a position outside the list as invalid', async () => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1, 4], checked: true });

    expect(result).toEqual(err({ kind: 'invalid' }));
    expect(fake.calls).toEqual([]);
  });

  it('refuses more than 200 positions as invalid', async () => {
    const fake = setup(current());
    const positions = Array.from({ length: 201 }, (_, index) => index + 1);

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions, checked: true });

    expect(result).toEqual(err({ kind: 'invalid' }));
    expect(fake.calls).toEqual([]);
  });

  it.each([['yes'], [undefined], [null], [1], [0], ['']])('refuses the tick value %j as invalid', async (checked) => {
    const fake = setup(current());

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked });

    expect(result).toEqual(err({ kind: 'invalid' }));
    expect(fake.calls).toEqual([]);
  });

  it.each([['12abc'], [0], [-3], [1.5], [undefined], [null]])(
    'refuses the menu number %j as invalid',
    async (menuNumber) => {
      const fake = setup(current());

      const result = await run(fake, { userId: ANA, menuNumber, positions: [1], checked: true });

      expect(result).toEqual(err({ kind: 'invalid' }));
      expect(fake.calls).toEqual([]);
    },
  );

  it('refuses as stale when the list changed while the page was open', async () => {
    const fake = setup([row(ANA, 'sel-1', 20, '2026-10-05')]);

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked: true });

    expect(result).toEqual(err({ kind: 'stale' }));
    expect(fake.calls).toEqual([]);
  });

  it('refuses as stale when the user has no current list', async () => {
    const fake = setup([]);

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked: true });

    expect(result).toEqual(err({ kind: 'stale' }));
    expect(fake.calls).toEqual([]);
  });

  it('writes only for the session user and its current selection, whatever else the request names', async () => {
    const fake = setup([row(ANA, 'sel-a', 9101, '2026-10-05'), row(BEA, 'sel-b', 9101, '2026-10-05')]);

    await run(fake, {
      userId: BEA,
      menuNumber: 9101,
      positions: [1],
      checked: true,
      ...{ selectionId: 'sel-a', targetUserId: ANA },
    });

    expect(fake.calls).toEqual([{ userId: BEA, selectionId: 'sel-b', positions: [1], checked: true }]);
  });

  it.each([['selections'], ['items'], ['write']] as const)('fails when the %s step fails', async (failing) => {
    const fake = setup(current(), failing);

    const result = await run(fake, { userId: ANA, menuNumber: 9101, positions: [1], checked: true });

    expect(result).toEqual(err({ kind: 'failed' }));
    if (failing !== 'write') expect(fake.calls).toEqual([]);
  });
});
