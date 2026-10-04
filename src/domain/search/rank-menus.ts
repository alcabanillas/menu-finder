import type { MenuScore } from '@/domain/search/score-menu';

/** The best menus, at most five, how many ranked menus tie with the first one, and every ranked menu in order. */
export type Ranking = { top: MenuScore[]; tiedWithFirst: number; ranked: MenuScore[] };

const TOP_SIZE = 5;

/** Scores are compared to six decimals, so that a floating-point error does not break a tie. */
const SIX_DECIMALS = 1_000_000;

/**
 * A menu below this score is not ranked: with two constraints both must count, with three two are enough. Fixed
 * before any golden-set result; compared at two decimals, like the matching threshold.
 */
export const MIN_MENU_SCORE = 0.6;
const TWO_DECIMALS = 100;

/** Orders the ranked menus by score, high to low, and by menu number, low to high, on a tie (spec menu-search, "Top five and ties"). */
export function rankMenus(scores: MenuScore[]): Ranking {
  const ordered = scores
    .filter(reachesMinimum)
    .sort((a, b) => comparableScore(b.score) - comparableScore(a.score) || a.menu - b.menu);
  return { top: ordered.slice(0, TOP_SIZE), tiedWithFirst: countTiedWithFirst(ordered), ranked: ordered };
}

function reachesMinimum({ score }: MenuScore): boolean {
  return Math.round(score * TWO_DECIMALS) / TWO_DECIMALS >= MIN_MENU_SCORE;
}

/** A score as compared for ties: two scores tie when they are equal to six decimals. */
export function comparableScore(score: number): number {
  return Math.round(score * SIX_DECIMALS);
}

function countTiedWithFirst(ordered: MenuScore[]): number {
  if (ordered.length === 0) return 0;
  const first = comparableScore(ordered[0].score);
  return ordered.filter(({ score }) => comparableScore(score) === first).length;
}
