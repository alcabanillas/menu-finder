import type { Day, MealType } from '@/domain/menu/weekly-menu';
import type { Constraint, SearchRequest } from '@/domain/search/search-request';
import { matchesTerm, type Strategy } from '@/domain/search/term-score';

/** A dish of a menu as the search scores it: where it is and its term score in [0, 1] for each constraint id. */
export type ScoredDish = {
  day: Day;
  meal: MealType;
  position: number;
  name: string;
  scores: Readonly<Record<string, number>>;
};

export type ScoredMenu = { menu: number; dishes: ScoredDish[] };

/**
 * What a menu is scored on (spec menu-search, "Constraint units and menu score"): each `sameDish` group, each
 * `anyOf` group and each ungrouped constraint. Members keep the order of the request.
 */
export type Unit = { kind: 'constraint' | 'sameDish' | 'anyOf'; members: Constraint[] };

/** The units of a request, in the order of their first constraint. */
export function toUnits(request: SearchRequest): Unit[] {
  const groupOf = groupsById(request);
  const units: Unit[] = [];
  for (const constraint of request.constraints) {
    const group = groupOf.get(constraint.id);
    if (!group) units.push({ kind: 'constraint', members: [constraint] });
    else if (!units.includes(group)) units.push(group);
  }
  return units;
}

/** An ungrouped exclusion applies to the whole week: it is scored by how many dishes break it. */
export function isWeekWideExclusion(unit: Unit): boolean {
  return unit.kind === 'constraint' && unit.members[0].polarity === 'exclude';
}

/** The score of a dish for a unit: the lowest of its members for "con", the highest for "o". */
export function dishUnitScore(unit: Unit, dish: ScoredDish): number {
  const scores = unit.members.map((member) => constraintScore(member, dish));
  return unit.kind === 'sameDish' ? Math.min(...scores) : Math.max(...scores);
}

/** Whether a dish of the constraint's slot matches its term. An exclusion is broken only by a matching dish. */
export function matchesConstraint(constraint: Constraint, dish: ScoredDish, strategy: Strategy): boolean {
  return inSlot(constraint, dish) && matchesTerm(dish.scores[constraint.id], strategy);
}

/**
 * Whether a dish keeps a constraint of a unit it must satisfy on its own: it is in the constraint's slot and matches
 * an include term or does not match an exclude term. In a group the slot describes the dish ("en la cena, un arroz
 * sin carne"), so a dish of another slot keeps no member.
 */
export function keepsConstraint(constraint: Constraint, dish: ScoredDish, strategy: Strategy): boolean {
  const matches = matchesTerm(dish.scores[constraint.id], strategy);
  return inSlot(constraint, dish) && (constraint.polarity === 'include' ? matches : !matches);
}

function groupsById(request: SearchRequest): Map<string, Unit> {
  const groupOf = new Map<string, Unit>();
  for (const kind of ['sameDish', 'anyOf'] as const) {
    for (const ids of request[kind]) {
      const unit: Unit = { kind, members: request.constraints.filter((constraint) => ids.includes(constraint.id)) };
      for (const id of ids) groupOf.set(id, unit);
    }
  }
  return groupOf;
}

function constraintScore(constraint: Constraint, dish: ScoredDish): number {
  if (!inSlot(constraint, dish)) return 0;
  const score = dish.scores[constraint.id];
  return constraint.polarity === 'include' ? score : 1 - score;
}

function inSlot(constraint: Constraint, dish: ScoredDish): boolean {
  return constraint.slot === undefined || constraint.slot === dish.meal;
}
