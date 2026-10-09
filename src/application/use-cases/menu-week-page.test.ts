import { describe, expect, it } from 'vitest';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import { menuWeekPage } from '@/application/use-cases/menu-week-page';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import type { Selection } from '@/domain/selection/selection';
import { err, ok } from '@/shared/result';

const TODAY = '2026-10-09';
const THIS_MONDAY = '2026-10-05';
const PAST_MONDAY = '2026-09-28';
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

  it('fails when the selections cannot be read', async () => {
    const page = await menuWeekPage(fakes([], true), { userId: 'user-a', startsOn: PAST_MONDAY });

    expect(page).toEqual(err({ kind: 'failed' }));
  });
});
