import type { MenuScore } from '@/domain/search/score-menu';

/** The best menus, at most five, and how many ranked menus tie with the first one. */
export type Ranking = { top: MenuScore[]; tiedWithFirst: number };

const TOP_SIZE = 5;

/** Scores are compared to six decimals, so that a floating-point error does not break a tie. */
const SIX_DECIMALS = 1_000_000;

/** Orders the ranked menus by score, high to low, and by menu number, low to high, on a tie (spec menu-search, "Top five and ties"). */
export function rankMenus(scores: MenuScore[]): Ranking {
  const ordered = [...scores].sort((a, b) => comparable(b.score) - comparable(a.score) || a.menu - b.menu);
  return { top: ordered.slice(0, TOP_SIZE), tiedWithFirst: countTiedWithFirst(ordered) };
}

function comparable(score: number): number {
  return Math.round(score * SIX_DECIMALS);
}

function countTiedWithFirst(ordered: MenuScore[]): number {
  if (ordered.length === 0) return 0;
  const first = comparable(ordered[0].score);
  return ordered.filter(({ score }) => comparable(score) === first).length;
}
