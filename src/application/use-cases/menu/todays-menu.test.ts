import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { todaysMenu } from '@/application/use-cases/menu/todays-menu';
import { type LocalDate } from '@/domain/selection/local-date';
import type { Day, MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

const FRIDAY: LocalDate = '2026-10-09';
const SUNDAY: LocalDate = '2026-10-11';
const THIS_MONDAY: LocalDate = '2026-10-05';
const NEXT_MONDAY: LocalDate = '2026-10-12';

const dish = (name: string): MenuDish => ({ position: 1, name, hasRecipeMark: false, recipeFile: null });
const lunchOn = (day: Day, name: string): WeeklyMenu['meals'][number] => ({ day, type: 'lunch', dishes: [dish(name)] });

const MENU_3: WeeklyMenu = {
  number: 3,
  meals: [lunchOn('friday', 'Lentejas'), lunchOn('saturday', 'Arroz al horno')],
};
const MENU_31: WeeklyMenu = { number: 31, meals: [lunchOn('monday', 'Pisto con huevo')] };
const MENU_32_NO_MONDAY: WeeklyMenu = { number: 32, meals: [lunchOn('tuesday', 'Merluza')] };

const THIS_WEEK: Selection = { id: 'sel-3', menuNumber: 3, startsOn: THIS_MONDAY };
const NEXT_WEEK: Selection = { id: 'sel-31', menuNumber: 31, startsOn: NEXT_MONDAY };

type Setup = {
  today?: LocalDate;
  selections?: Selection[];
  menus?: WeeklyMenu[];
  failListing?: boolean;
  failMenu?: number;
};

const fakes = ({ today = FRIDAY, selections = [THIS_WEEK], menus = [MENU_3], failListing = false, failMenu }: Setup = {}) => {
  const listed: string[] = [];
  const deps = {
    selections: {
      listFrom: async (userId: string) => {
        listed.push(userId);
        return failListing ? err({ kind: 'read-failed' as const, reason: 'down' }) : ok(selections);
      },
      replace: async () => err({ kind: 'write-failed' as const, reason: 'not used' }),
      checkedPositions: async () => err({ kind: 'read-failed' as const, reason: 'not used' }),
      setChecked: async () => err({ kind: 'write-failed' as const, reason: 'not used' }),
    } satisfies SelectionRepository,
    clock: { today: () => today } satisfies Clock,
    menus: {
      find: async (number: number) =>
        number === failMenu
          ? err({ kind: 'read-failed' as const, reason: 'down' })
          : ok(menus.find((menu) => menu.number === number) ?? null),
    } satisfies Pick<MenuRepository, 'find'>,
    recipes: { findByFiles: async () => ok([]) } satisfies Pick<RecipeRepository, 'findByFiles'>,
  };
  return { deps, listed };
};

const tomorrowOf = async (setup: Setup) => {
  const result = await todaysMenu(fakes(setup).deps, { userId: 'user-a' });
  return result.ok ? result.value.tomorrow : result;
};

describe('todaysMenu on a weekday', () => {
  it('gives today and the next day of the same week', async () => {
    const result = await todaysMenu(fakes().deps, { userId: 'user-a' });

    expect(result.ok && result.value.today).toBe(FRIDAY);
    expect(result.ok && result.value.day?.date).toBe(FRIDAY);
    expect(result.ok && result.value.day?.meals.lunch[0].name).toBe('Lentejas');
    expect(result.ok && result.value.tomorrow).toMatchObject({ kind: 'day', day: { date: '2026-10-10' } });
  });

  it('gives no tomorrow when tomorrow has no dishes', async () => {
    expect(await tomorrowOf({ today: '2026-10-06' })).toEqual({ kind: 'none' });
  });

  it('gives no day when this week has no menu', async () => {
    const result = await todaysMenu(fakes({ selections: [] }).deps, { userId: 'user-a' });

    expect(result).toEqual(ok({ today: FRIDAY, day: null, tomorrow: { kind: 'none' } }));
  });

  it('reads the selections with the given user id only', async () => {
    const { deps, listed } = fakes();

    await todaysMenu(deps, { userId: 'user-a' });

    expect(listed).toEqual(['user-a']);
  });

  it.each([
    ['the selections', { failListing: true }],
    ["this week's menu", { failMenu: 3 }],
  ])('fails when %s cannot be read', async (_name, setup: Setup) => {
    expect(await todaysMenu(fakes(setup).deps, { userId: 'user-a' })).toEqual(err({ kind: 'failed' }));
  });
});

describe('todaysMenu on a Sunday', () => {
  const sunday = { today: SUNDAY, menus: [MENU_3, MENU_31, MENU_32_NO_MONDAY] };

  it("gives next week's Monday with its menu number and date when next week is chosen", async () => {
    const tomorrow = await tomorrowOf({ ...sunday, selections: [THIS_WEEK, NEXT_WEEK] });

    expect(tomorrow).toMatchObject({ kind: 'next-week', menuNumber: 31, startsOn: NEXT_MONDAY });
    expect(tomorrow).toMatchObject({ day: { day: 'monday', date: NEXT_MONDAY } });
  });

  it("gives today's Sunday with no dishes", async () => {
    const result = await todaysMenu(fakes({ ...sunday, selections: [THIS_WEEK] }).deps, { userId: 'user-a' });

    expect(result.ok && result.value.day?.day).toBe('sunday');
    expect(result.ok && result.value.day?.meals).toEqual({ lunch: [], dinner: [] });
  });

  it('says there is no menu, with next Monday, when next week has none', async () => {
    expect(await tomorrowOf({ ...sunday })).toEqual({ kind: 'no-menu', startsOn: NEXT_MONDAY });
  });

  it("gives none when next week's Monday has no dishes", async () => {
    const next: Selection = { id: 'sel-32', menuNumber: 32, startsOn: NEXT_MONDAY };

    expect(await tomorrowOf({ ...sunday, selections: [THIS_WEEK, next] })).toEqual({ kind: 'none' });
  });

  it("gives none and keeps today when next week's menu cannot be read", async () => {
    const result = await todaysMenu(
      fakes({ ...sunday, selections: [THIS_WEEK, NEXT_WEEK], failMenu: 31 }).deps,
      { userId: 'user-a' },
    );

    expect(result.ok && result.value.day?.date).toBe(SUNDAY);
    expect(result.ok && result.value.tomorrow).toEqual({ kind: 'none' });
  });
});
