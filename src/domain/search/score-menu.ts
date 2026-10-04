import {
  dishUnitScore,
  isWeekWideExclusion,
  matchesConstraint,
  type ScoredDish,
  type ScoredMenu,
  type Unit,
} from '@/domain/search/constraint-unit';
import type { Strategy } from '@/domain/search/term-score';

/** The score of a unit for a menu and the dish that gave it; a week-wide exclusion has no such dish. */
type UnitScore = { score: number; evidence: ScoredDish | null };

export type MenuScore = { menu: number; score: number; units: UnitScore[] };

/** Scores a menu as the mean of its unit scores (spec menu-search, "Constraint units and menu score"). */
export function scoreMenu({ menu, dishes }: ScoredMenu, units: Unit[], strategy: Strategy): MenuScore {
  const unitScores = units.map((unit) => scoreUnit(unit, dishes, strategy));
  return { menu, score: mean(unitScores.map((unitScore) => unitScore.score)), units: unitScores };
}

function scoreUnit(unit: Unit, dishes: ScoredDish[], strategy: Strategy): UnitScore {
  if (isWeekWideExclusion(unit)) {
    return { score: weekWideExclusionScore(unit, dishes, strategy), evidence: null };
  }
  return bestDish(unit, dishes);
}

// Each dish that breaks the exclusion costs more: 1 for none, 0.5 for one, 0.25 for three.
function weekWideExclusionScore({ members: [exclusion] }: Unit, dishes: ScoredDish[], strategy: Strategy): number {
  const breaking = dishes.filter((dish) => matchesConstraint(exclusion, dish, strategy)).length;
  return 1 / (1 + breaking);
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
