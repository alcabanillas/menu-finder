import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DailyLimitedSearchError, SearchResultDto, TextSearchDto } from '@/application/dto/search-result';
import type { Result } from '@/shared/result';

type Structure = Required<SearchRequestDto>;
type Constraint = Structure['constraints'][number];
type Evidence = SearchResultDto['menus'][number]['evidence'][number];

/** One constraint of a chip, as the search returned it. */
export type ChipMember = Pick<Constraint, 'term' | 'polarity' | 'type' | 'hard' | 'slot'>;

/** One unit of the request: a constraint in no group, a `sameDish` group or an `anyOf` group (spec menu-planner). */
export type Chip = { kind: SearchResultDto['units'][number]['kind']; members: ChipMember[] };

/** What a card says about one unit: its kind (how its terms are separated), its terms, whether the menu answers it, and the dish or the reason. */
export type EvidenceLine = { kind: Chip['kind']; terms: ChipMember[]; found: boolean; detail: string };

export type CandidateCard = { rank: number; menu: number; lines: EvidenceLine[] };

/**
 * What the planner shows for a search, built on the server (MF-22.4 design D1). `attempt` counts the answers: it tells
 * a new answer from the previous one even when the message is the same.
 */
export type PlannerSearchState =
  | { status: 'idle'; attempt: number }
  | { status: 'ranking'; chips: Chip[]; cards: CandidateCard[]; attempt: number }
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

/** What the page says to a blank request, on the server and, with JavaScript, in the browser before any trip. */
export const EMPTY_REQUEST_MESSAGE = MESSAGES['request-too-short'];

const DAYS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

const MEALS: Record<string, string> = { lunch: 'comida', dinner: 'cena' };

/** The view of a search: a ranking with its chips and cards, or the message of the outcome that gave none. */
export function toSearchState(result: Result<TextSearchDto, DailyLimitedSearchError>, attempt: number): PlannerSearchState {
  if (!result.ok) return { status: 'failed', kind: result.error.kind, message: MESSAGES[result.error.kind], attempt };
  const { structure, result: ranking } = result.value;
  const chips = toChips(structure, ranking.units);
  const cards = ranking.menus.map(({ menu, evidence }, index) => ({
    rank: index + 1,
    menu,
    lines: toEvidenceLines(chips, evidence),
  }));
  return { status: 'ranking', chips, cards, attempt };
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

function toMember({ term, polarity, type, hard, slot }: Constraint): ChipMember {
  return { term, polarity, type, hard, slot };
}

function toLine({ kind, members }: Chip, { dish }: Evidence): EvidenceLine {
  if (dish) {
    return { kind, terms: members, found: true, detail: `${DAYS[dish.day]}, ${MEALS[dish.meal]} · ${dish.name}` };
  }
  const onlyExclusions = members.every(({ polarity }) => polarity === 'exclude');
  return onlyExclusions
    ? { kind, terms: members, found: true, detail: 'no aparece en la semana' }
    : { kind, terms: members, found: false, detail: 'ningún plato' };
}
