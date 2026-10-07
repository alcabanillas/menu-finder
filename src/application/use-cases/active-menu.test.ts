import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { activeMenu } from '@/application/use-cases/active-menu';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

type Row = Selection & { userId: string };

const ANA = 'user-a';
const BEA = 'user-b';
const WEDNESDAY = '2026-10-07';
const MENU_3: Row = { userId: ANA, id: 'sel-3', menuNumber: 3, startsOn: '2026-10-05' };
const NEXT_WEEK: Row = { userId: ANA, id: 'sel-12', menuNumber: 12, startsOn: '2026-10-12' };

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

const STORED_MENU: WeeklyMenu = {
  number: 3,
  meals: [
    { day: 'monday', type: 'lunch', dishes: [dish(1, 'Lentejas estofadas', 'Lentejas'), dish(2, 'Fruta', null)] },
    { day: 'tuesday', type: 'dinner', dishes: [dish(1, 'Lentejas estofadas', 'Lentejas')] },
  ],
};

type Failure = 'none' | 'selections' | 'menu' | 'recipes' | 'menu-missing';

const fakes = (rows: Row[], failure: Failure = 'none') => {
  const asked = { menus: [] as number[], files: [] as string[][] };
  const readFailed = { kind: 'read-failed' as const, reason: 'connection refused' };
  const selections: SelectionRepository = {
    listFrom: async (userId, from) =>
      failure === 'selections'
        ? err(readFailed)
        : ok(
            rows
              .filter((row) => row.userId === userId && row.startsOn >= from)
              .map(({ id, menuNumber, startsOn }) => ({ id, menuNumber, startsOn })),
          ),
    replace: async () => err({ kind: 'write-failed', reason: 'not used' }),
  };
  const menus: Pick<MenuRepository, 'find'> = {
    find: async (number) => {
      asked.menus.push(number);
      if (failure === 'menu') return err(readFailed);
      return ok(failure === 'menu-missing' || number !== STORED_MENU.number ? null : STORED_MENU);
    },
  };
  const recipes: Pick<RecipeRepository, 'findByFiles'> = {
    findByFiles: async (files) => {
      asked.files.push(files);
      return failure === 'recipes' ? err(readFailed) : ok([lentejas].filter(({ file }) => files.includes(file)));
    },
  };
  const clock: Clock = { today: () => WEDNESDAY };
  return { deps: { selections, menus, recipes, clock }, asked };
};

describe('activeMenu', () => {
  it('gives the active menu laid on its week, with today', async () => {
    const { deps } = fakes([MENU_3, NEXT_WEEK]);

    const result = await activeMenu(deps, { userId: ANA });

    expect(result.ok).toBe(true);
    const week = result.ok ? result.value : null;
    expect(week).toMatchObject({ menuNumber: 3, startsOn: '2026-10-05', today: WEDNESDAY });
    expect(week?.days.map(({ date }) => date)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(week?.days[0].meals.lunch).toEqual([
      { name: 'Lentejas estofadas', recipe: expect.objectContaining({ title: 'Lentejas estofadas' }) },
      { name: 'Fruta', recipe: null },
    ]);
  });

  it('gives no menu when the only selection starts next week', async () => {
    const { deps, asked } = fakes([NEXT_WEEK]);

    expect(await activeMenu(deps, { userId: ANA })).toEqual(ok(null));
    expect(asked.menus).toEqual([]);
  });

  it('gives no menu to a user with no selection, although another user has one', async () => {
    const { deps } = fakes([MENU_3]);

    expect(await activeMenu(deps, { userId: BEA })).toEqual(ok(null));
  });

  it('asks only for the recipes of the menu’s distinct recipe files', async () => {
    const { deps, asked } = fakes([MENU_3]);

    await activeMenu(deps, { userId: ANA });

    expect(asked.menus).toEqual([3]);
    expect(asked.files).toEqual([['Lentejas']]);
  });

  it.each<Failure>(['selections', 'menu', 'recipes', 'menu-missing'])('fails when reading fails: %s', async (failure) => {
    const { deps } = fakes([MENU_3], failure);

    expect(await activeMenu(deps, { userId: ANA })).toEqual(err({ kind: 'failed' }));
  });
});
