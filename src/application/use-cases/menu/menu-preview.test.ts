import { describe, expect, it } from 'vitest';
import type { MenuRepository } from '@/application/ports/menu-repository';
import { menuPreview } from '@/application/use-cases/menu/menu-preview';
import type { Meal, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { err, ok } from '@/shared/result';

function meal(day: Meal['day'], type: Meal['type'], names: string[], recipeFile: string | null = null): Meal {
  return { day, type, dishes: names.map((name, index) => ({ position: index + 1, name, hasRecipeMark: recipeFile !== null, recipeFile })) };
}

const MENU_22: WeeklyMenu = {
  number: 22,
  meals: [
    meal('monday', 'lunch', ['Garbanzos con espinacas'], 'garbanzos-con-espinacas'),
    meal('monday', 'dinner', ['Crema de calabacín', 'Tortilla francesa']),
    meal('tuesday', 'lunch', ['Arroz con verduras']),
  ],
};

const menus = (find: MenuRepository['find']) => ({ menus: { find } satisfies Pick<MenuRepository, 'find'> });

describe('menuPreview', () => {
  it('gives the names of the dishes by day and meal, Monday to Sunday, and nothing else', async () => {
    const preview = await menuPreview(menus(async () => ok(MENU_22)), { menuNumber: 22 });

    expect(preview).toEqual(
      ok({
        menuNumber: 22,
        days: [
          { day: 'monday', lunch: ['Garbanzos con espinacas'], dinner: ['Crema de calabacín', 'Tortilla francesa'] },
          { day: 'tuesday', lunch: ['Arroz con verduras'], dinner: [] },
          { day: 'wednesday', lunch: [], dinner: [] },
          { day: 'thursday', lunch: [], dinner: [] },
          { day: 'friday', lunch: [], dinner: [] },
          { day: 'saturday', lunch: [], dinner: [] },
          { day: 'sunday', lunch: [], dinner: [] },
        ],
      }),
    );
    expect(JSON.stringify(preview)).not.toMatch(/garbanzos-con-espinacas|recipe|position/);
  });

  it('accepts the number as the digits a form sends', async () => {
    const asked: number[] = [];
    await menuPreview(menus(async (number) => (asked.push(number), ok(MENU_22))), { menuNumber: '22' });

    expect(asked).toEqual([22]);
  });

  it.each(['12abc', 0, -3, 1.5, '1.5', '', null, undefined, new Blob(['x']), {}, Number.MAX_SAFE_INTEGER + 1])(
    'gives invalid-menu for %j and reads nothing',
    async (value) => {
      let reads = 0;
      const preview = await menuPreview(menus(async () => (reads += 1, ok(MENU_22))), { menuNumber: value });

      expect(preview).toEqual(err({ kind: 'invalid-menu' }));
      expect(reads).toBe(0);
    },
  );

  it('gives unknown-menu for a positive integer no stored menu has', async () => {
    const preview = await menuPreview(menus(async () => ok(null)), { menuNumber: 999 });

    expect(preview).toEqual(err({ kind: 'unknown-menu' }));
  });

  it('gives failed when reading the menu fails', async () => {
    const preview = await menuPreview(menus(async () => err({ kind: 'read-failed' as const, reason: 'down' })), { menuNumber: 22 });

    expect(preview).toEqual(err({ kind: 'failed' }));
  });
});
