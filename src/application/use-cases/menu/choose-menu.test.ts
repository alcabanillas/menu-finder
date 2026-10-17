import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { chooseMenu } from '@/application/use-cases/menu/choose-menu';
import { err, ok } from '@/shared/result';

const clock: Clock = { today: () => '2026-10-07' };

const fakeSelections = () => {
  const replaced: { userId: string; menuNumber: number; startsOn: string }[] = [];
  const selections: SelectionRepository = {
    listFrom: async () => ok([]),
    replace: async (userId, choice) => {
      replaced.push({ userId, ...choice });
      return ok({ id: 'new-1', ...choice });
    },
    checkedPositions: async () => err({ kind: 'read-failed', reason: 'not used' }),
    setChecked: async () => err({ kind: 'write-failed', reason: 'not used' }),
  };
  return { selections, replaced };
};

describe('chooseMenu', () => {
  it('passes the user, the menu and the week to selectMenu and returns its result', async () => {
    const fake = fakeSelections();

    const result = await chooseMenu({ selections: fake.selections, clock }, { userId: 'user-a', menuNumber: '22', week: 'next' });

    expect(result).toEqual(ok({ id: 'new-1', menuNumber: 22, startsOn: '2026-10-12' }));
    expect(fake.replaced).toEqual([{ userId: 'user-a', menuNumber: 22, startsOn: '2026-10-12' }]);
  });

  it('returns the failure of selectMenu', async () => {
    const fake = fakeSelections();

    const result = await chooseMenu({ selections: fake.selections, clock }, { userId: 'user-a', menuNumber: '22', week: '2026-10-19' });

    expect(result).toEqual(err({ kind: 'invalid-week' }));
    expect(fake.replaced).toEqual([]);
  });
});
