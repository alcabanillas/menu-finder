import { describe, expect, it } from 'vitest';
import type { Selection } from '@/domain/selection/selection';
import { currentOf, isLocked, mondayOfWeek, suggestedWeek, weekDates } from '@/domain/selection/week';

const MENU_3: Selection = { id: 'sel-3', menuNumber: 3, startsOn: '2026-10-05' };
const MENU_12: Selection = { id: 'sel-12', menuNumber: 12, startsOn: '2026-10-12' };

describe('mondayOfWeek', () => {
  it('gives this Monday for the current week', () => {
    expect(mondayOfWeek('2026-10-07', 'current')).toBe('2026-10-05');
  });

  it('gives the same day for the current week on a Monday', () => {
    expect(mondayOfWeek('2026-10-05', 'current')).toBe('2026-10-05');
  });

  it('gives next Monday for the next week', () => {
    expect(mondayOfWeek('2026-10-07', 'next')).toBe('2026-10-12');
  });

  it('gives next Monday for the next week on a Sunday', () => {
    expect(mondayOfWeek('2026-10-11', 'next')).toBe('2026-10-12');
  });
});

describe('isLocked', () => {
  it('locks this week once next week is chosen, with a menu on this week', () => {
    expect(isLocked('current', [MENU_3, MENU_12], '2026-10-08')).toBe(true);
  });

  it('locks this week once next week is chosen, with this week empty', () => {
    expect(isLocked('current', [MENU_12], '2026-10-08')).toBe(true);
  });

  it('does not lock this week while next week is empty', () => {
    expect(isLocked('current', [MENU_3], '2026-10-08')).toBe(false);
  });

  it('never locks next week', () => {
    expect(isLocked('next', [MENU_3, MENU_12], '2026-10-08')).toBe(false);
  });
});

describe('suggestedWeek', () => {
  it('suggests this week when nothing is chosen', () => {
    expect(suggestedWeek([], '2026-10-07')).toBe('current');
  });

  it('suggests next week when this week is chosen', () => {
    expect(suggestedWeek([MENU_3], '2026-10-07')).toBe('next');
  });

  it('suggests next week when only next week is chosen, because this week is locked', () => {
    expect(suggestedWeek([MENU_12], '2026-10-07')).toBe('next');
  });

  it('suggests next week when both weeks are chosen', () => {
    expect(suggestedWeek([MENU_3, MENU_12], '2026-10-07')).toBe('next');
  });
});

describe('currentOf', () => {
  it('gives this week’s menu for both when it is the only one', () => {
    expect(currentOf([MENU_3], '2026-10-08')).toEqual({ activeMenu: MENU_3, shoppingSelection: MENU_3 });
  });

  it('gives next week’s menu as the shopping list once it is chosen', () => {
    expect(currentOf([MENU_3, MENU_12], '2026-10-09')).toEqual({ activeMenu: MENU_3, shoppingSelection: MENU_12 });
  });

  it('gives no active menu when only next week is chosen', () => {
    expect(currentOf([MENU_12], '2026-10-09')).toEqual({ activeMenu: null, shoppingSelection: MENU_12 });
  });

  it('keeps a menu active until its Sunday', () => {
    expect(currentOf([MENU_3], '2026-10-11')).toEqual({ activeMenu: MENU_3, shoppingSelection: MENU_3 });
  });

  it('gives nothing on the Monday after a menu ends', () => {
    expect(currentOf([MENU_3], '2026-10-12')).toEqual({ activeMenu: null, shoppingSelection: null });
  });

  it('gives nothing to a user who never chose', () => {
    expect(currentOf([], '2026-10-07')).toEqual({ activeMenu: null, shoppingSelection: null });
  });
});

describe('weekDates', () => {
  it('gives the seven dates of the week, from its Monday', () => {
    expect(weekDates('2026-10-05')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
  });

  it('keeps the dates consecutive across the daylight-saving change at the end of October', () => {
    expect(weekDates('2026-10-19').slice(5)).toEqual(['2026-10-24', '2026-10-25']);
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('crosses the end of the year', () => {
    expect(weekDates('2026-12-28').slice(3)).toEqual(['2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  });
});