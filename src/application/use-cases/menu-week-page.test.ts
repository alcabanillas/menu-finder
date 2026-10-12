import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { menuWeekPage } from '@/application/use-cases/menu-week-page';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

const TODAY = '2026-10-09';
const THIS_MONDAY = '2026-10-05';
const PAST_MONDAY = '2026-09-28';
const NEXT_MONDAY = '2026-10-12';
const MENU_3: WeeklyMenu = { number: 3, meals: [] };
const WEEK_OF_THIS_MONDAY = [
  '2026-10-05',
  '2026-10-06',
  '2026-10-07',
  '2026-10-08',
  '2026-10-09',
  '2026-10-10',
  '2026-10-11',
];

const clock: Clock = { today: () => TODAY };

const fakes = (selections: Selection[] = [], failListing = false) => {
  const repositories = {
    selections: {
      listFrom: async () => (failListing ? err({ kind: 'read-failed' as const, reason: 'down' }) : ok(selections)),
      replace: async () => err({ kind: 'write-failed' as const, reason: 'not used' }),
      checkedPositions: async () => err({ kind: 'read-failed' as const, reason: 'not used' }),
      setChecked: async () => err({ kind: 'write-failed' as const, reason: 'not used' }),
    } satisfies SelectionRepository,
    clock,
    menus: { find: async () => ok(MENU_3) } satisfies Pick<MenuRepository, 'find'>,
    recipes: { findByFiles: async () => ok([]) } satisfies Pick<RecipeRepository, 'findByFiles'>,
  };
  return repositories;
};

describe('menuWeekPage', () => {
  it('shows this week when startsOn is missing or invalid, with the neighbours of this week', async () => {
    const page = await menuWeekPage(fakes(), { userId: 'user-a', startsOn: 'not-a-date' });

    expect(page).toEqual(
      ok({
        navigation: {
          shown: THIS_MONDAY,
          current: THIS_MONDAY,
          previous: '2026-09-28',
          next: '2026-10-12',
          status: 'current',
          days: WEEK_OF_THIS_MONDAY,
        },
        menu: null,
      }),
    );
  });

  it('shows the validated past week with its menu, and says the week is past', async () => {
    const selection: Selection = { id: 'sel-3', menuNumber: 3, startsOn: PAST_MONDAY };
    const page = await menuWeekPage(fakes([selection]), { userId: 'user-a', startsOn: PAST_MONDAY });

    expect(page.ok && page.value.navigation.status).toBe('past');
    expect(page.ok && page.value.navigation.shown).toBe(PAST_MONDAY);
    expect(page.ok && page.value.menu?.menuNumber).toBe(3);
  });

  it('shows next week without a menu, and says the week is future', async () => {
    const page = await menuWeekPage(fakes(), { userId: 'user-a', startsOn: NEXT_MONDAY });

    expect(page.ok && page.value.navigation.status).toBe('future');
    expect(page.ok && page.value.navigation.shown).toBe(NEXT_MONDAY);
    expect(page.ok && page.value.menu).toBeNull();
  });

  it('fails when the selections cannot be read', async () => {
    const page = await menuWeekPage(fakes([], true), { userId: 'user-a', startsOn: PAST_MONDAY });

    expect(page).toEqual(err({ kind: 'failed' }));
  });
});

type Row = Selection & { userId: string };

const ANA = 'user-a';
const BEA = 'user-b';
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

const MENU_3_WITH_LUNCH: WeeklyMenu = {
  number: 3,
  meals: [{ day: 'monday', type: 'lunch', dishes: [dish(1, 'Lentejas estofadas', 'Lentejas')] }],
};

type Calls = { listed: string[]; found: number[] };

const recordingFakes = (rows: Row[], menus: WeeklyMenu[] = [MENU_3_WITH_LUNCH]) => {
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

describe('the week menu', () => {
  it('lays the menu of the requested week on its dates, for the signed-in user', async () => {
    const { deps } = recordingFakes([ANA_MENU_3]);

    const result = await menuWeekPage(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(result.ok && result.value.menu?.startsOn).toBe(PAST_MONDAY);
    expect(result.ok && result.value.menu?.menuNumber).toBe(3);
  });

  it('reads one menu by its number', async () => {
    const { deps, calls } = recordingFakes([ANA_MENU_3]);

    await menuWeekPage(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(calls.found).toEqual([3]);
  });

  it('reads the selections from ten weeks before this Monday', async () => {
    const { deps, calls } = recordingFakes([ANA_MENU_3]);

    await menuWeekPage(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(calls.listed).toEqual(['2026-07-27']);
  });

  it('gives no week when the user has no selection for the requested Monday', async () => {
    const { deps } = recordingFakes([ANA_MENU_3]);

    const result = await menuWeekPage(deps, { userId: ANA, startsOn: THIS_MONDAY });

    expect(result.ok && result.value.menu).toBeNull();
  });

  it('never shows another user’s selection for the same week', async () => {
    const { deps } = recordingFakes([BEA_MENU_12]);

    const result = await menuWeekPage(deps, { userId: ANA, startsOn: THIS_MONDAY });

    expect(result.ok && result.value.menu).toBeNull();
  });

  it('shows this week instead of a Monday older than the window, even when a selection exists for it', async () => {
    const { deps } = recordingFakes([{ ...ANA_MENU_3, startsOn: TOO_OLD_MONDAY }]);

    const result = await menuWeekPage(deps, { userId: ANA, startsOn: TOO_OLD_MONDAY });

    expect(result.ok && result.value.navigation.shown).toBe(THIS_MONDAY);
    expect(result.ok && result.value.menu).toBeNull();
  });

  it('fails when the selection points to a menu that is not stored', async () => {
    const { deps } = recordingFakes([ANA_MENU_3], []);

    const result = await menuWeekPage(deps, { userId: ANA, startsOn: PAST_MONDAY });

    expect(result).toEqual(err({ kind: 'failed' }));
  });

  it('fails when the menu of the selection cannot be read', async () => {
    const { deps } = recordingFakes([ANA_MENU_3]);

    const result = await menuWeekPage(
      { ...deps, menus: { find: async () => err({ kind: 'read-failed', reason: 'down' }) } },
      { userId: ANA, startsOn: PAST_MONDAY },
    );

    expect(result).toEqual(err({ kind: 'failed' }));
  });

  it('fails when the recipes of the menu cannot be read', async () => {
    const { deps } = recordingFakes([ANA_MENU_3]);

    const result = await menuWeekPage(
      { ...deps, recipes: { findByFiles: async () => err({ kind: 'read-failed', reason: 'down' }) } },
      { userId: ANA, startsOn: PAST_MONDAY },
    );

    expect(result).toEqual(err({ kind: 'failed' }));
  });
});
