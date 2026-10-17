import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { weeksToChoose } from '@/application/use-cases/menu/weeks-to-choose';
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

const fakeSelections = (rows: Row[], fails = false) => {
  const asked: { userId: string; from: LocalDate }[] = [];
  const selections: SelectionRepository = {
    listFrom: async (userId, from) => {
      asked.push({ userId, from });
      if (fails) return err({ kind: 'read-failed', reason: 'connection refused' });
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

describe('weeksToChoose', () => {
  it('gives two empty weeks and suggests this week when nothing is chosen', async () => {
    const fake = fakeSelections([OLD]);

    const result = await weeksToChoose({ selections: fake.selections, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(
      ok({
        current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: null, locked: false },
        next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: null, locked: false },
        suggested: 'current',
      }),
    );
    expect(fake.asked).toEqual([{ userId: ANA, from: '2026-10-05' }]);
  });

  it('gives this week’s menu and suggests next week when this week is chosen', async () => {
    const fake = fakeSelections([MENU_3]);

    const result = await weeksToChoose({ selections: fake.selections, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(
      ok({
        current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: 3, locked: false },
        next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: null, locked: false },
        suggested: 'next',
      }),
    );
  });

  it('locks this week once next week is chosen', async () => {
    const fake = fakeSelections([MENU_3, MENU_12]);

    const result = await weeksToChoose({ selections: fake.selections, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(
      ok({
        current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: 3, locked: true },
        next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: 12, locked: false },
        suggested: 'next',
      }),
    );
  });

  it('does not show another user’s selections', async () => {
    const fake = fakeSelections([MENU_3, MENU_12]);

    const result = await weeksToChoose({ selections: fake.selections, clock: fixedClock('2026-10-07') }, { userId: BEA });

    expect(result).toEqual(
      ok({
        current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: null, locked: false },
        next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: null, locked: false },
        suggested: 'current',
      }),
    );
  });

  it('fails when the selections cannot be read', async () => {
    const fake = fakeSelections([], true);

    const result = await weeksToChoose({ selections: fake.selections, clock: fixedClock('2026-10-07') }, { userId: ANA });

    expect(result).toEqual(err({ kind: 'failed' }));
  });
});
