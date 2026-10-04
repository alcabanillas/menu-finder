import { describe, expect, it } from 'vitest';
import { rankMenus } from '@/domain/search/rank-menus';
import type { MenuScore } from '@/domain/search/score-menu';

function scored(menu: number, score: number): MenuScore {
  return { menu, score, units: [{ score, evidence: null }] };
}

function order(scores: MenuScore[]): number[] {
  return rankMenus(scores).top.map(({ menu }) => menu);
}

describe('rankMenus', () => {
  it('returns the five best of twelve menus, the best first', () => {
    const twelve = Array.from({ length: 12 }, (_, index) => scored(index + 1, (index + 1) / 12));

    expect(order(twelve)).toEqual([12, 11, 10, 9, 8]);
  });

  it('orders equal scores by menu number, from low to high, and counts the menus tied with the first', () => {
    const ranking = rankMenus([scored(9, 1), scored(5, 0.8), scored(3, 1), scored(7, 1)]);

    expect(ranking.top.map(({ menu }) => menu)).toEqual([3, 7, 9, 5]);
    expect(ranking.tiedWithFirst).toBe(3);
  });

  it('compares scores to six decimals', () => {
    const ranking = rankMenus([scored(2, 0.7 + 0.1), scored(1, 0.8)]);

    expect(ranking.top.map(({ menu }) => menu)).toEqual([1, 2]);
    expect(ranking.tiedWithFirst).toBe(2);
  });

  it('returns fewer than five menus when fewer are ranked', () => {
    expect(order([scored(4, 0.7), scored(8, 0.9)])).toEqual([8, 4]);
  });

  it('leaves out the menus that score less than 0.6, compared at two decimals', () => {
    const ranking = rankMenus([scored(1, 0.59), scored(2, 0.5999999999), scored(3, 1), scored(4, 0)]);

    expect(ranking.top.map(({ menu }) => menu)).toEqual([3, 2]);
  });

  it('returns an empty ranking with no tie when no menu reaches 0.6', () => {
    expect(rankMenus([scored(1, 0.5), scored(2, 0.5)])).toEqual({ top: [], tiedWithFirst: 0 });
  });

  it('returns an empty ranking with no tie when no menu is ranked', () => {
    expect(rankMenus([])).toEqual({ top: [], tiedWithFirst: 0 });
  });

  it('keeps the evidence of every unit of the menus it returns', () => {
    const evidence = { day: 'monday', meal: 'lunch', position: 1, name: 'Pollo asado', scores: { pollo: 1 } } as const;
    const menu: MenuScore = { menu: 1, score: 1, units: [{ score: 1, evidence }] };

    expect(rankMenus([menu]).top[0].units[0].evidence).toBe(evidence);
  });
});
