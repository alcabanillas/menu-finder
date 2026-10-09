import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { weekMenu } from '@/application/use-cases/week-menu';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

type Row = Selection & { userId: string };

const ANA = 'user-a';
const BEA = 'user-b';
const TODAY = '2026-10-09';
const THIS_MONDAY = '2026-10-05';
const PAST_MONDAY = '2026-09-28';
const TOO_OLD_MONDAY = '2026-07-20';
const ANA_MENU_3: Row = { userId: ANA, id: 'sel-3', menuNumber: 3, startsOn: PAST_MONDAY };
const BEA_MENU_12: Row = { userId: BEA, id: 'sel-12', menuNumber: 12, startsOn: THIS_MONDAY };

const dish = (position: number, name: string, recipeFile: string | null): MenuDish => ({
  position,
  name,
  hasRecipeMark: recipeFile !== null,
  recipeFile,
});

const lentejas: Recipe = {
  file: 'Lentejas',
  sourceMenu: 3,
  title: 'Lentejas estofadas',
  times: { total: 45, preparation: 10, cooking: 35, resting: null },
  ingredients: [],
  preparation: ['Cocer.'],
};

const MENU_3: WeeklyMenu = {
  number: 3,
  meals: [{ day: 'monday', type: 'lunch', dishes: [dish(1, 'Lentejas estofadas', 'Lentejas')] }],
};

const clock: Clock = { today: () => TODAY };

type Calls = { listed: string[]; found: number[] };

const fakes = (rows: Row[], menus: WeeklyMenu[] = [MENU_3]) => {
  const calls: Calls = { listed: [], found: [] };
  const selections: SelectionRepository = {
    listFrom: async (userId, from) => {
      calls.listed.push(from);
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
  // Only `find` is passed: the use case cannot list all menus, by type.
  const menuRepository: Pick<MenuRepository, 'find'> = {
    find: async (number) => {
      calls.found.push(number);
      return ok(menus.find((menu) => menu.number === number) ?? null);
    },
  };
  const recipes: Pick<RecipeRepository, 'findByFiles'> = {
    findByFiles: async () => ok([lentejas]),
  };
  return { deps: { selections, clock, menus: menuRepository, recipes }, calls };
};

describe('weekMenu', () => {
  it('lays the menu of the requested week on its dates, for the signed-in user', async () => {
    const { deps } = fakes([ANA_MENU_3]);

    const result = await weekMenu(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(result.ok && result.value?.startsOn).toBe(PAST_MONDAY);
    expect(result.ok && result.value?.menuNumber).toBe(3);
  });

  it('reads one menu by its number', async () => {
    const { deps, calls } = fakes([ANA_MENU_3]);

    await weekMenu(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(calls.found).toEqual([3]);
  });

  it('reads the selections from ten weeks before this Monday', async () => {
    const { deps, calls } = fakes([ANA_MENU_3]);

    await weekMenu(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(calls.listed).toEqual(['2026-07-27']);
  });

  it('gives no week when the user has no selection for the requested Monday', async () => {
    const { deps } = fakes([ANA_MENU_3]);

    const result = await weekMenu(deps, { userId: ANA, startsOn: THIS_MONDAY });

    expect(result).toEqual(ok(null));
  });

  it('never shows another user’s selection for the same week', async () => {
    const { deps } = fakes([BEA_MENU_12]);

    const result = await weekMenu(deps, { userId: ANA, startsOn: THIS_MONDAY });

    expect(result).toEqual(ok(null));
  });

  it('gives no week for a Monday older than the window even when a selection exists', async () => {
    const { deps } = fakes([{ ...ANA_MENU_3, startsOn: TOO_OLD_MONDAY }]);

    const result = await weekMenu(deps, { userId: ANA, startsOn: TOO_OLD_MONDAY });

    expect(result).toEqual(ok(null));
  });

  it('fails when the selection points to a menu that is not stored', async () => {
    const { deps } = fakes([ANA_MENU_3], []);

    const result = await weekMenu(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(result).toEqual(err({ kind: 'failed' }));
  });
});
