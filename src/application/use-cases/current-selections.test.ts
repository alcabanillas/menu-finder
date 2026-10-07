import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { currentSelections } from '@/application/use-cases/current-selections';
import type { LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

type Row = Selection & { userId: string };

const ANA = 'user-a';
const BEA = 'user-b';
const OLD: Row = { userId: ANA, id: 'sel-old', menuNumber: 1, startsOn: '2026-09-28' };
const MENU_3: Row = { userId: ANA, id: 'sel-3', menuNumber: 3, startsOn: '2026-10-05' };
const MENU_12: Row = { userId: ANA, id: 'sel-12', menuNumber: 12, startsOn: '2026-10-12' };

const fixedClock = (today: LocalDate): Clock => ({ today: () => today });

const fakeSelections = (rows: Row[]) => {
  const asked: { userId: string; from: LocalDate }[] = [];
  const selections: SelectionRepository = {
    listFrom: async (userId, from) => {
      asked.push({ userId, from });
      return ok(
        rows
          .filter((row) => row.userId === userId && row.startsOn >= from)
          .map(({ id, menuNumber, startsOn }) => ({ id, menuNumber, startsOn })),
      );
    },
    replace: async () => err({ kind: 'write-failed', reason: 'not used' }),
    checkedPositions: async () => err({ kind: 'read-failed', reason: 'not used' }),
    setChecked: async () => err({ kind: 'write-failed', reason: 'not used' }),
  };
  return { selections, asked };
};

const selection = ({ id, menuNumber, startsOn }: Row): Selection => ({ id, menuNumber, startsOn });

describe('currentSelections', () => {
  it('gives the active menu and the shopping list from the user’s rows of this Monday on', async () => {
    const fake = fakeSelections([OLD, MENU_3, MENU_12]);

    const result = await currentSelections(
      { selections: fake.selections, clock: fixedClock('2026-10-09') },
      { userId: ANA },
    );

    expect(result).toEqual(ok({ activeMenu: selection(MENU_3), shoppingList: selection(MENU_12) }));
    expect(fake.asked).toEqual([{ userId: ANA, from: '2026-10-05' }]);
  });

  it('does not show another user’s selections', async () => {
    const fake = fakeSelections([MENU_3]);

    const result = await currentSelections(
      { selections: fake.selections, clock: fixedClock('2026-10-07') },
      { userId: BEA },
    );

    expect(result).toEqual(ok({ activeMenu: null, shoppingList: null }));
  });

  it('fails when the selections cannot be read', async () => {
    const selections: SelectionRepository = {
      listFrom: async () => err({ kind: 'read-failed', reason: 'connection refused' }),
      replace: async () => err({ kind: 'write-failed', reason: 'not used' }),
      checkedPositions: async () => err({ kind: 'read-failed', reason: 'not used' }),
      setChecked: async () => err({ kind: 'write-failed', reason: 'not used' }),
    };

    const result = await currentSelections({ selections, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(err({ kind: 'failed' }));
  });
});
