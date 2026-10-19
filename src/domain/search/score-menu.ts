import {
  dishUnitScore,
  holdsLiterally,
  isWeekWideExclusion,
  type ScoredDish,
  type ScoredMenu,
  type Unit,
} from '@/domain/search/constraint-unit';
import { matchesTerm, type Strategy } from '@/domain/search/term-score';

/** How the evidence of a unit was found: a dish with the term word for word, a dish similar enough, or none. */
type EvidenceMatch = 'literal' | 'similar' | 'none';

/** The score of a unit for a menu, the dish shown as its evidence and how it was found; a week-wide exclusion has none. */
type UnitScore = { score: number; evidence: ScoredDish | null; match: EvidenceMatch };

export type MenuScore = { menu: number; score: number; units: UnitScore[] };

/** A week-wide exclusion is a filter: a menu it keeps has no dish that breaks it. */
const KEPT_BY_FILTER: UnitScore = { score: 1, evidence: null, match: 'none' };

/**
 * Scores a menu as the mean of its unit scores, without the week-wide exclusions, which only filter; 1 when every unit
 * is one (spec menu-search, "Constraint units and menu score"). Every unit keeps its score, so the evidence stays aligned.
 */
export function scoreMenu({ menu, dishes }: ScoredMenu, units: Unit[], strategy: Strategy): MenuScore {
  const unitScores = units.map((unit) => (isWeekWideExclusion(unit) ? KEPT_BY_FILTER : unitEvidence(unit, dishes, strategy)));
  const scored = unitScores.filter((_, index) => !isWeekWideExclusion(units[index]));
  return { menu, score: scored.length === 0 ? 1 : mean(scored.map((unitScore) => unitScore.score)), units: unitScores };
}

/**
 * The score of a unit is its best dish's; its evidence is the first literal dish, or else the best dish when it
 * matches as the hard filter decides, or else none (spec menu-search, "Evidence of a unit"; MF-61 design D1).
 */
function unitEvidence(unit: Unit, dishes: ScoredDish[], strategy: Strategy): UnitScore {
  const best = bestDish(unit, dishes);
  const literal = dishes.find((dish) => holdsLiterally(unit, dish, strategy));
  if (literal) return { score: best.score, evidence: literal, match: 'literal' };
  if (best.dish && matchesTerm(best.score, strategy)) return { score: best.score, evidence: best.dish, match: 'similar' };
  return { score: best.score, evidence: null, match: 'none' };
}

// The first dish wins a tie, so the evidence depends only on the menu order. A dish that scores 0 explains nothing.
function bestDish(unit: Unit, dishes: ScoredDish[]): { score: number; dish: ScoredDish | null } {
  let best: { score: number; dish: ScoredDish | null } = { score: 0, dish: null };
  for (const dish of dishes) {
    const score = dishUnitScore(unit, dish);
    if (score > best.score) best = { score, dish };
  }
  return best;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
