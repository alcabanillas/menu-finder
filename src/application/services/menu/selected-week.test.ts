import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import { selectedWeek } from '@/application/services/menu/selected-week';
import type { MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Recipe } from '@/domain/recipe/recipe';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

const TODAY = '2026-10-09';
const THIS_MONDAY = '2026-10-05';
const SELECTION: Selection = { id: 'sel-3', menuNumber: 3, startsOn: THIS_MONDAY };

const clock: Clock = { today: () => TODAY };

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
  meals: [
    {
      day: 'monday',
      type: 'lunch',
      dishes: [dish(1, 'Lentejas estofadas', 'Lentejas'), dish(2, 'Fruta', null), dish(3, 'Pan', 'Lentejas')],
    },
  ],
};

const depsWith = (menu: WeeklyMenu | null, files: string[][] = []) => ({
  clock,
  menus: { find: async () => ok(menu) } satisfies Pick<MenuRepository, 'find'>,
  recipes: {
    findByFiles: async (requested: string[]) => {
      files.push(requested);
      return ok([lentejas]);
    },
  } satisfies Pick<RecipeRepository, 'findByFiles'>,
});

describe('selectedWeek', () => {
  it('lays the menu of a selection on its dates, each dish with its recipe', async () => {
    const week = await selectedWeek(depsWith(MENU_3), SELECTION);

    expect(week.ok && week.value.menuNumber).toBe(3);
    expect(week.ok && week.value.startsOn).toBe(THIS_MONDAY);
    expect(week.ok && week.value.days[0].meals.lunch[0].recipe?.title).toBe('Lentejas estofadas');
  });

  it('asks once for the recipe files of the menu, without repeats or dishes with no recipe', async () => {
    const files: string[][] = [];

    await selectedWeek(depsWith(MENU_3, files), SELECTION);

    expect(files).toEqual([['Lentejas']]);
  });

  it('fails when the menu of the selection is missing', async () => {
    const week = await selectedWeek(depsWith(null), SELECTION);

    expect(week).toEqual(err({ kind: 'failed' }));
  });

  it('fails when the menu cannot be read', async () => {
    const deps = { ...depsWith(MENU_3), menus: { find: async () => err({ kind: 'read-failed' as const, reason: 'down' }) } };

    expect(await selectedWeek(deps, SELECTION)).toEqual(err({ kind: 'failed' }));
  });

  it('fails when the recipes cannot be read', async () => {
    const deps = {
      ...depsWith(MENU_3),
      recipes: { findByFiles: async () => err({ kind: 'read-failed' as const, reason: 'down' }) },
    };

    expect(await selectedWeek(deps, SELECTION)).toEqual(err({ kind: 'failed' }));
  });
});
