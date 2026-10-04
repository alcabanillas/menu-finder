import { describe, expect, it } from 'vitest';
import { hitAt5, ndcgAt5, type Grades, type RankedMenu } from '@/domain/search/ranking-metrics';

/** A ranking with strictly decreasing scores, so that no two menus tie. */
function untied(menus: number[]): RankedMenu[] {
  return menus.map((menu, index) => ({ menu, score: 1 - index / 100 }));
}

/** Grades of menus 1 to n, in order. */
function grades(...values: number[]): Grades {
  return new Map(values.map((grade, index) => [index + 1, grade]));
}

function rounded(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10_000) / 10_000;
}

describe('ndcgAt5', () => {
  it('is 1 when the five returned menus are the five best graded, in order', () => {
    const graded = grades(0, 2, 1, 2, 1, 1, 0);

    expect(ndcgAt5(untied([2, 4, 3, 5, 6]), graded)).toBe(1);
  });

  it('follows the worked example: grades 0, 2, 0, 1, 0 against the best 2, 2, 1, 1, 1 give 0.3696', () => {
    // Menus 1 to 5 are returned; menus 6 to 8 hold the rest of the best grades.
    const graded = grades(0, 2, 0, 1, 0, 2, 1, 1);

    expect(rounded(ndcgAt5(untied([1, 2, 3, 4, 5]), graded))).toBeCloseTo(0.3696, 4);
  });

  it('gives every position of a tie the mean grade of the tied group, also past the fifth position', () => {
    // Menu 1 scores alone; menus 2 to 7 tie, and only menu 2 has grade 2.
    const ranking = [{ menu: 1, score: 1 }, ...[2, 3, 4, 5, 6, 7].map((menu) => ({ menu, score: 0.8 }))];

    expect(rounded(ndcgAt5(ranking, grades(2, 2, 0, 0, 0, 0, 0)))).toBeCloseTo(0.8123, 4);
  });

  it('compares scores to six decimals to find a tie', () => {
    const ranking = [
      { menu: 1, score: 0.7 + 0.1 },
      { menu: 2, score: 0.8 },
    ];

    expect(ndcgAt5(ranking, grades(0, 2))).toBeCloseTo(ndcgAt5(ranking, grades(2, 0))!, 10);
  });

  it('scores a ranking of fewer than five menus on the menus it returned', () => {
    expect(rounded(ndcgAt5(untied([2]), grades(0, 2, 2)))).toBe(rounded(2 / (2 + 2 / Math.log2(3))));
  });

  it('is 0 for an empty ranking', () => {
    expect(ndcgAt5([], grades(2, 1))).toBe(0);
  });

  it('is null when every grade is 0, so that the query stays out of the means', () => {
    expect(ndcgAt5(untied([1, 2]), grades(0, 0, 0))).toBeNull();
  });

  it('counts a menu without a grade as grade 0', () => {
    expect(ndcgAt5(untied([9, 1]), grades(2))).toBeCloseTo(ndcgAt5(untied([3, 1]), grades(2, 0, 0))!, 10);
  });
});

describe('hitAt5', () => {
  it('is 1 when a grade-2 menu is in the top five without a tie', () => {
    expect(hitAt5(untied([1, 2, 3, 4, 5]), grades(0, 0, 0, 0, 2))).toBe(1);
  });

  it('is 0 when the grade-2 menus are past the fifth position', () => {
    expect(hitAt5(untied([1, 2, 3, 4, 5, 6]), grades(1, 1, 1, 1, 1, 2))).toBe(0);
  });

  it('is the chance that a random order of a tie puts a grade-2 menu in the top five', () => {
    // The ten best menus tie and only menu 10 has grade 2: 1 - C(9,5)/C(10,5).
    const ranking = Array.from({ length: 10 }, (_, index) => ({ menu: index + 1, score: 1 }));

    expect(hitAt5(ranking, grades(0, 0, 0, 0, 0, 0, 0, 0, 0, 2))).toBe(0.5);
  });

  it('ignores a tie that starts past the fifth position', () => {
    const ranking = [...untied([1, 2, 3, 4, 5]), { menu: 6, score: 0.1 }, { menu: 7, score: 0.1 }];

    expect(hitAt5(ranking, grades(0, 0, 0, 0, 0, 0, 2))).toBe(0);
  });

  it('is 1 when a tie lies entirely inside the top five and holds a grade-2 menu', () => {
    const ranking = [
      { menu: 1, score: 1 },
      { menu: 2, score: 1 },
      { menu: 3, score: 0.9 },
    ];

    expect(hitAt5(ranking, grades(0, 2, 0))).toBe(1);
  });

  it('is 0 for an empty ranking', () => {
    expect(hitAt5([], grades(2))).toBe(0);
  });

  it('is null when no menu has grade 2', () => {
    expect(hitAt5(untied([1, 2]), grades(1, 1, 0))).toBeNull();
  });
});
