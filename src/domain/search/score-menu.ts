import { dishUnitScore, isWeekWideExclusion, type ScoredDish, type ScoredMenu, type Unit } from '@/domain/search/constraint-unit';

/** The score of a unit for a menu and the dish that gave it; a week-wide exclusion has no such dish. */
type UnitScore = { score: number; evidence: ScoredDish | null };

export type MenuScore = { menu: number; score: number; units: UnitScore[] };

/** A week-wide exclusion is a filter: a menu it keeps has no dish that breaks it. */
const KEPT_BY_FILTER: UnitScore = { score: 1, evidence: null };

/**
 * Scores a menu as the mean of its unit scores, without the week-wide exclusions, which only filter; 1 when every unit
 * is one (spec menu-search, "Constraint units and menu score"). Every unit keeps its score, so the evidence stays aligned.
 */
export function scoreMenu({ menu, dishes }: ScoredMenu, units: Unit[]): MenuScore {
  const unitScores = units.map((unit) => (isWeekWideExclusion(unit) ? KEPT_BY_FILTER : bestDish(unit, dishes)));
  const scored = unitScores.filter((_, index) => !isWeekWideExclusion(units[index]));
  return { menu, score: scored.length === 0 ? 1 : mean(scored.map((unitScore) => unitScore.score)), units: unitScores };
}

// The first dish wins a tie, so the evidence depends only on the menu order. A dish that scores 0 explains nothing.
function bestDish(unit: Unit, dishes: ScoredDish[]): UnitScore {
  let best: UnitScore = { score: 0, evidence: null };
  for (const dish of dishes) {
    const score = dishUnitScore(unit, dish);
    if (score > best.score) best = { score, evidence: dish };
  }
  return best;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
