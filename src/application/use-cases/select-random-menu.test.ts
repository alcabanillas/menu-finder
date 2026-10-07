import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { selectRandomMenu } from '@/application/use-cases/select-random-menu';
import type { LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

type Stored = Selection & { userId: string };

const ANA = 'user-a';
const MONDAY: LocalDate = '2026-10-05';
const LAST_RANDOM = 0.999_999;

const fixedClock: Clock = { today: () => MONDAY };

const fakeMenus = (numbers: number[], fails = false): MenuRepository => ({
  saveAll: async () => ok(undefined),
  list: async () =>
    fails ? err({ kind: 'read-failed', reason: 'connection refused' }) : ok(numbers.map((number) => ({ number, meals: [] }))),
});

const fakeSelections = (failure: 'none' | 'read' | 'unknown-menu' = 'none') => {
  const stored: Stored[] = [];
  const selections: SelectionRepository = {
    listFrom: async () => (failure === 'read' ? err({ kind: 'read-failed', reason: 'connection refused' }) : ok([])),
    replace: async (userId, choice) => {
      if (failure === 'unknown-menu') return err({ kind: 'unknown-menu' });
      const selection = { id: `id-${stored.length + 1}`, ...choice };
      stored.push({ userId, ...selection });
      return ok(selection);
    },
  };
  return { selections, stored };
};

const depsWith = ({
  menus = fakeMenus([3, 12, 20]),
  random = (): number => 0.5,
  selections = fakeSelections(),
} = {}) => ({
  deps: { menus, selections: selections.selections, clock: fixedClock, random },
  stored: selections.stored,
});

describe('selectRandomMenu', () => {
  it('chooses the menu the random number falls on, from this Monday, for the user', async () => {
    const { deps, stored } = depsWith({ random: () => 0.5 });

    const result = await selectRandomMenu(deps, { userId: ANA });

    expect(result).toEqual({ ok: true, value: { id: 'id-1', menuNumber: 12, startsOn: MONDAY } });
    expect(stored).toEqual([{ userId: ANA, id: 'id-1', menuNumber: 12, startsOn: MONDAY }]);
  });

  it.each([
    [0, 3],
    [LAST_RANDOM, 20],
  ])('picks a stored menu at either end of the random range (%s gives %s)', async (random, menuNumber) => {
    const { deps } = depsWith({ random: () => random });

    const result = await selectRandomMenu(deps, { userId: ANA });

    expect(result.ok && result.value.menuNumber).toBe(menuNumber);
  });

  it('stores nothing when no menu is stored', async () => {
    const { deps, stored } = depsWith({ menus: fakeMenus([]) });

    await expect(selectRandomMenu(deps, { userId: ANA })).resolves.toEqual({ ok: false, error: { kind: 'no-menus' } });
    expect(stored).toEqual([]);
  });

  it('reports a failure to read the menus as failed', async () => {
    const { deps, stored } = depsWith({ menus: fakeMenus([3], true) });

    await expect(selectRandomMenu(deps, { userId: ANA })).resolves.toEqual({ ok: false, error: { kind: 'failed' } });
    expect(stored).toEqual([]);
  });

  it.each(['read', 'unknown-menu'] as const)('reports a selection error (%s) as failed', async (failure) => {
    const { deps } = depsWith({ selections: fakeSelections(failure) });

    await expect(selectRandomMenu(deps, { userId: ANA })).resolves.toEqual({ ok: false, error: { kind: 'failed' } });
  });
});
