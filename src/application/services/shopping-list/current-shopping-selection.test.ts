import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { currentShoppingSelection } from '@/application/services/shopping-list/current-shopping-selection';
import type { LocalDate } from '@/domain/selection/local-date';
import { err, ok } from '@/shared/result';

type Row = { userId: string; id: string; menuNumber: number; startsOn: LocalDate };

const ANA = 'user-a';
const BEA = 'user-b';

const fixedClock = (today: LocalDate): Clock => ({ today: () => today });

const row = (userId: string, id: string, menuNumber: number, startsOn: LocalDate): Row => ({
  userId,
  id,
  menuNumber,
  startsOn,
});

function setup(rows: Row[], failing = false): { selections: SelectionRepository } {
  const selections: SelectionRepository = {
    listFrom: async (userId, from) => {
      if (failing) return err({ kind: 'read-failed', reason: 'down' });
      return ok(
        rows
          .filter((r) => r.userId === userId && r.startsOn >= from)
          .sort((a, b) => a.startsOn.localeCompare(b.startsOn))
          .map(({ id, menuNumber, startsOn }) => ({ id, menuNumber, startsOn })),
      );
    },
    replace: async () => err({ kind: 'write-failed', reason: 'not used' }),
    checkedPositions: async () => ok([]),
    setChecked: async () => err({ kind: 'write-failed', reason: 'not used' }),
  };
  return { selections };
}

describe('currentShoppingSelection', () => {
  it('gives null when the user has no current shopping list', async () => {
    const fake = setup([row(BEA, 'sel-1', 9101, '2026-10-05')]);

    const result = await currentShoppingSelection({ ...fake, clock: fixedClock('2026-10-07') }, ANA);

    expect(result).toEqual(ok(null));
  });

  it('gives the selection whose list is current', async () => {
    const fake = setup([row(ANA, 'sel-1', 9101, '2026-10-05')]);

    const result = await currentShoppingSelection({ ...fake, clock: fixedClock('2026-10-07') }, ANA);

    expect(result).toEqual(ok({ id: 'sel-1', menuNumber: 9101, startsOn: '2026-10-05' }));
  });

  it('gives the read error when listing the selections fails', async () => {
    const fake = setup([row(ANA, 'sel-1', 9101, '2026-10-05')], true);

    const result = await currentShoppingSelection({ ...fake, clock: fixedClock('2026-10-07') }, ANA);

    expect(result).toEqual(err({ kind: 'read-failed', reason: 'down' }));
  });
});
