import {
  isWeekWideExclusion,
  keepsConstraint,
  matchesConstraint,
  type ScoredDish,
  type ScoredMenu,
  type Unit,
} from '@/domain/search/constraint-unit';
import type { Strategy } from '@/domain/search/term-score';

/** How many menus a hard unit removes on its own; the UI chip shows it (BUS-descomponedor). */
type RemovedMenus = { constraints: string[]; menusRemoved: number };

export type HardFilter = { kept: ScoredMenu[]; removedBy: RemovedMenus[] };

/** Keeps the menus that satisfy every hard unit and counts, for each hard unit, the menus it removes on its own. */
export function filterByHardUnits(menus: ScoredMenu[], units: Unit[], strategy: Strategy): HardFilter {
  const hardUnits = units.filter(isHard);
  return {
    kept: menus.filter((menu) => hardUnits.every((unit) => satisfiesUnit(unit, menu.dishes, strategy))),
    removedBy: hardUnits.map((unit) => countRemoved(unit, menus, strategy)),
  };
}

/**
 * Whether a menu's dishes satisfy a unit (spec menu-search, "Hard constraints"). One rule for every unit: a dish
 * matches a term at the strategy's threshold, and an exclusion is broken only by a matching dish, alone or in a group.
 * A week-wide exclusion is kept when no dish of its slot matches; any other unit needs one dish that keeps it.
 */
export function satisfiesUnit(unit: Unit, dishes: ScoredDish[], strategy: Strategy): boolean {
  if (isWeekWideExclusion(unit)) return !dishes.some((dish) => matchesConstraint(unit.members[0], dish, strategy));
  return dishes.some((dish) => dishSatisfies(unit, dish, strategy));
}

function isHard(unit: Unit): boolean {
  return unit.members.some((member) => member.hard);
}

function countRemoved(unit: Unit, menus: ScoredMenu[], strategy: Strategy): RemovedMenus {
  return {
    constraints: unit.members.map((member) => member.id),
    menusRemoved: menus.filter((menu) => !satisfiesUnit(unit, menu.dishes, strategy)).length,
  };
}

// "o" needs one member; a single constraint and "con" need all of them.
function dishSatisfies(unit: Unit, dish: ScoredDish, strategy: Strategy): boolean {
  const kept = unit.members.map((member) => keepsConstraint(member, dish, strategy));
  return unit.kind === 'anyOf' ? kept.some(Boolean) : kept.every(Boolean);
}
