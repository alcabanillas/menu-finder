/** How a term is matched against a dish (spec menu-search): by its text, by its embedding, or by both. */
export type Strategy = 'lexical' | 'semantic' | 'hybrid';

/**
 * The term score from which a dish matches a term, fixed before seeing any result (design D6). The hybrid has its
 * own, because a mean of 0 and 1 is exactly 0.5: at 0.5 the most similar dish of every term would always match.
 */
export const MATCH_THRESHOLD: Readonly<Record<Strategy, number>> = { lexical: 0.5, semantic: 0.5, hybrid: 0.75 };

/** A score is compared to the threshold at two decimals. */
const TWO_DECIMALS = 100;

/** Rescales the similarities of one term so that the least similar dish scores 0 and the most similar scores 1. */
export function rescaleSimilarities(similarities: number[]): number[] {
  const lowest = Math.min(...similarities);
  const range = Math.max(...similarities) - lowest;
  // A term with the same similarity for every dish cannot tell them apart, so it gives no evidence.
  if (range === 0) return similarities.map(() => 0);
  return similarities.map((similarity) => (similarity - lowest) / range);
}

/** The mean of both parts, with equal weights fixed in the code and never tuned on the golden set. */
export function hybridScore(lexical: number, semantic: number): number {
  return (lexical + semantic) / 2;
}

/**
 * Whether a dish matches a term: it decides the hard constraints and what breaks an exclusion. The score is
 * rounded to two decimals first, so that a floating-point error (0.4999999999999999 for 0.5) does not move the threshold.
 */
export function matchesTerm(score: number, strategy: Strategy): boolean {
  return Math.round(score * TWO_DECIMALS) / TWO_DECIMALS >= MATCH_THRESHOLD[strategy];
}
