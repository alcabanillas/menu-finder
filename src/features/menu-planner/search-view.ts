import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DailyLimitedSearchError, SearchResultDto, TextSearchDto } from '@/application/dto/search-result';
import type { DayDto } from '@/application/dto/weekly-menu';
import type { Result } from '@/shared/result';

type Structure = Required<SearchRequestDto>;
type Constraint = Structure['constraints'][number];
type Evidence = SearchResultDto['menus'][number]['evidence'][number];
type Dish = NonNullable<Evidence['dish']>;

/** One constraint of a chip, as the search returned it. */
export type ChipMember = Pick<Constraint, 'term' | 'polarity' | 'type' | 'hard' | 'slot'>;

/** One unit of the request: a constraint in no group, a `sameDish` group or an `anyOf` group (spec menu-planner). */
export type Chip = { kind: SearchResultDto['units'][number]['kind']; members: ChipMember[] };

/**
 * What a card says about one unit: its kind (how its terms are separated), its terms, whether the menu meets it with a
 * literal dish, only with a similar one, or not at all (✓, ≈, ✕), and the dish or the reason (MF-61 design D4).
 */
export type EvidenceLine = {
  kind: Chip['kind'];
  terms: ChipMember[];
  state: 'met' | 'similar' | 'unmet';
  detail: string;
  /** The dish behind the line, by day, meal and name; `null` when the unit has none. The week preview marks it. */
  dish: { day: DayDto; meal: Dish['meal']; name: string } | null;
};

/** A dish of the week preview that is the evidence of a unit: ✓ (`met`) or ≈ (`similar`) and the unit's terms. */
export type EvidenceMark = { day: DayDto; meal: Dish['meal']; name: string; state: 'met' | 'similar'; label: string };

/**
 * A menu of the ranking. `rank` and `summary` are null when the request has only week-wide exclusions: every card
 * meets it alike, and the cards come by menu number.
 */
export type CandidateCard = { rank: number | null; menu: number; summary: string | null; lines: EvidenceLine[] };

/**
 * What the planner shows for a search, built on the server (MF-22.4 design D1). `attempt` counts the answers: it tells
 * a new answer from the previous one even when the message is the same. `request` is the text as it was sent, untrimmed,
 * so that "Editar mi búsqueda" can put it back in the box (MF-73 design D8).
 */
export type PlannerSearchState =
  | { status: 'idle'; attempt: number }
  | { status: 'ranking'; request: string; chips: Chip[]; cards: CandidateCard[]; onlyExclusions: boolean; attempt: number }
  | { status: 'failed'; kind: DailyLimitedSearchError['kind']; message: string; attempt: number };

export const IDLE_SEARCH: PlannerSearchState = { status: 'idle', attempt: 0 };

const UNDERSTAND_FAILURE = 'No he sabido entender la petición. Prueba a escribirla de otra forma.';
const SYSTEM_FAILURE = 'No se ha podido buscar. Inténtalo de nuevo.';

const MESSAGES: Record<DailyLimitedSearchError['kind'], string> = {
  'request-too-short': 'Escribe qué te apetece.',
  'request-too-long': 'La petición es demasiado larga: como mucho 300 caracteres.',
  rejected: 'Eso no parece una petición de menús. Prueba a decir qué te apetece comer.',
  'invalid-answer': UNDERSTAND_FAILURE,
  'nothing-to-search': UNDERSTAND_FAILURE,
  'llm-limit-reached': 'Hoy ya no se pueden hacer más búsquedas. Vuelve a intentarlo mañana.',
  'decomposer-failed': SYSTEM_FAILURE,
  'embedding-failed': SYSTEM_FAILURE,
  'search-failed': SYSTEM_FAILURE,
  'index-not-loaded': SYSTEM_FAILURE,
  'invalid-request': SYSTEM_FAILURE,
};

/** The days as the cards and the week preview write them. */
export const DAY_NAMES: Record<DayDto, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const MEALS: Record<Dish['meal'], string> = { lunch: 'comida', dinner: 'cena' };

/** The counts of similar dishes up to ten are written in words, as the mock does; above, in digits. */
const NUMBER_WORDS = ['', 'una', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

/** The view of a search: a ranking with its chips and cards, or the message of the outcome that gave none. */
export function toSearchState(
  result: Result<TextSearchDto, DailyLimitedSearchError>,
  attempt: number,
  request: string,
): PlannerSearchState {
  if (!result.ok) return toFailedState(result.error.kind, attempt);
  const { structure, result: ranking } = result.value;
  if (!isAligned(structure, ranking)) return toFailedState('search-failed', attempt);
  const chips = toChips(structure, ranking.units);
  const onlyExclusions = chips.every(isWeekWideExclusion);
  const cards = ranking.menus.map(({ menu, evidence }, index) => {
    const lines = toEvidenceLines(chips, evidence);
    return onlyExclusions
      ? { rank: null, menu, summary: null, lines }
      : { rank: index + 1, menu, summary: summarize(lines), lines };
  });
  return { status: 'ranking', request, chips, cards, onlyExclusions, attempt };
}

/** One chip per unit, in the order of the units. The search already grouped the constraints: this only looks them up. */
export function toChips(structure: Structure, units: SearchResultDto['units']): Chip[] {
  const byId = new Map(structure.constraints.map((constraint) => [constraint.id, constraint]));
  return units.map(({ kind, constraints }) => ({
    kind,
    members: constraints.map((id) => toMember(byId.get(id) as Constraint)),
  }));
}

/** The evidence of a menu is aligned with the chips by index (MF-22.4 design D4). */
export function toEvidenceLines(chips: Chip[], evidence: Evidence[]): EvidenceLine[] {
  return chips.map((chip, index) => toLine(chip, evidence[index]));
}

/**
 * The fixed sentence of a card, built only from the counts of its lines, never from a term or a dish (spec
 * menu-planner, "Candidate cards with evidence and a choose button"; safety-first §2.6).
 */
export function summarize(lines: EvidenceLine[]): string {
  const total = lines.length;
  const met = lines.filter(({ state }) => state !== 'unmet').length;
  const similar = lines.filter(({ state }) => state === 'similar').length;
  return `${metSentence(met, total)}${similarClause(similar)}`;
}

/**
 * The dishes of a card that are the evidence of a unit, for the week preview to mark: ✓ for a literal one, ≈ for a similar
 * one, with the terms of the unit joined by " y " (same dish) or " o " (any of). Units with no dish mark nothing.
 */
export function evidenceMarks(lines: EvidenceLine[]): EvidenceMark[] {
  return lines.flatMap(({ kind, terms, state, dish }) => {
    if (!dish || state === 'unmet') return [];
    const joiner = kind === 'anyOf' ? ' o ' : ' y ';
    return [{ ...dish, state, label: terms.map(({ term }) => term).join(joiner) }];
  });
}

/** What a screen reader says for a chip, and for the terms of an evidence line (spec menu-planner). */
export function describeChip({ kind, members }: Pick<Chip, 'kind' | 'members'>): string {
  const prefix = { constraint: '', sameDish: 'En el mismo plato: ', anyOf: 'Una de: ' }[kind];
  return prefix + members.map(describeMember).join(kind === 'anyOf' ? ' o ' : ' y ');
}

function toFailedState(kind: DailyLimitedSearchError['kind'], attempt: number): PlannerSearchState {
  return { status: 'failed', kind, message: MESSAGES[kind], attempt };
}

// The search promises every unit's ids in the structure and one evidence item per unit (spec menu-search); a broken
// promise is a failure of the system, not an error page (MF-22.4 design D4).
function isAligned({ constraints }: Structure, { units, menus }: SearchResultDto): boolean {
  const ids = new Set(constraints.map(({ id }) => id));
  const knownIds = units.every((unit) => unit.constraints.every((id) => ids.has(id)));
  return knownIds && menus.every(({ evidence }) => evidence.length === units.length);
}

function toMember({ term, polarity, type, hard, slot }: Constraint): ChipMember {
  return { term, polarity, type, hard, slot };
}

function toLine({ kind, members }: Chip, { dish, match }: Evidence): EvidenceLine {
  if (dish) {
    const where = `${DAY_NAMES[dish.day]}, ${MEALS[dish.meal]} · ${dish.name}`;
    const named = { day: dish.day, meal: dish.meal, name: dish.name };
    return match === 'literal'
      ? { kind, terms: members, state: 'met', detail: where, dish: named }
      : { kind, terms: members, state: 'similar', detail: `parecido: ${where}`, dish: named };
  }
  const onlyExclusions = members.every(({ polarity }) => polarity === 'exclude');
  return onlyExclusions
    ? { kind, terms: members, state: 'met', detail: 'no aparece en la semana', dish: null }
    : { kind, terms: members, state: 'unmet', detail: 'ningún plato', dish: null };
}

// An exclusion in no group filters the whole week (BUS-superficie-consulta (b)).
function isWeekWideExclusion({ kind, members }: Chip): boolean {
  return kind === 'constraint' && members[0].polarity === 'exclude';
}

function metSentence(met: number, total: number): string {
  if (met === total) return total === 1 ? 'Cumple lo que pides' : `Cumple las ${total} cosas que pides`;
  return `Cumple ${met} de las ${total} cosas que pides`;
}

function similarClause(similar: number): string {
  if (similar === 0) return '.';
  const count = NUMBER_WORDS[similar] ?? String(similar);
  return similar === 1 ? `, ${count} con un plato parecido.` : `, ${count} con platos parecidos.`;
}

function describeMember({ polarity, type, term, hard, slot }: ChipMember): string {
  const hardness = hard ? ', obligatorio' : ', preferencia';
  const meal = slot ? `, en la ${MEALS[slot]}` : '';
  return roleOf(polarity, type) + term + hardness + meal;
}

function roleOf(polarity: ChipMember['polarity'], type: ChipMember['type']): string {
  if (polarity === 'exclude') return 'excluido: ';
  return type === 'attribute' ? 'atributo: ' : '';
}
