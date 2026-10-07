import { describe, expect, it } from 'vitest';
import type { Selection } from '@/domain/selection/selection';
import { currentOf, startsOnFor } from '@/domain/selection/week';

const MENU_3: Selection = { id: 'sel-3', menuNumber: 3, startsOn: '2026-10-05' };
const MENU_12: Selection = { id: 'sel-12', menuNumber: 12, startsOn: '2026-10-12' };

describe('startsOnFor', () => {
  it('gives this Monday when choosing in a week with no menu', () => {
    expect(startsOnFor('2026-10-07', [])).toBe('2026-10-05');
  });

  it('gives the same day when choosing on a Monday with no menu', () => {
    expect(startsOnFor('2026-10-05', [])).toBe('2026-10-05');
  });

  it('gives next Monday when choosing while a menu is active', () => {
    expect(startsOnFor('2026-10-09', [MENU_3])).toBe('2026-10-12');
  });

  it('gives next Monday when next week is already chosen too', () => {
    expect(startsOnFor('2026-10-10', [MENU_3, MENU_12])).toBe('2026-10-12');
  });
});

describe('currentOf', () => {
  it('gives this week’s menu for both when it is the only one', () => {
    expect(currentOf([MENU_3], '2026-10-08')).toEqual({ activeMenu: MENU_3, shoppingList: MENU_3 });
  });

  it('gives next week’s menu as the shopping list once it is chosen', () => {
    expect(currentOf([MENU_3, MENU_12], '2026-10-09')).toEqual({ activeMenu: MENU_3, shoppingList: MENU_12 });
  });

  it('gives no active menu when only next week is chosen', () => {
    expect(currentOf([MENU_12], '2026-10-09')).toEqual({ activeMenu: null, shoppingList: MENU_12 });
  });

  it('keeps a menu active until its Sunday', () => {
    expect(currentOf([MENU_3], '2026-10-11')).toEqual({ activeMenu: MENU_3, shoppingList: MENU_3 });
  });

  it('gives nothing on the Monday after a menu ends', () => {
    expect(currentOf([MENU_3], '2026-10-12')).toEqual({ activeMenu: null, shoppingList: null });
  });

  it('gives nothing to a user who never chose', () => {
    expect(currentOf([], '2026-10-07')).toEqual({ activeMenu: null, shoppingList: null });
  });
});
