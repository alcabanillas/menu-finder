import { z } from 'zod';
import type { SearchRequestDto, SearchRequestError } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import type { DishAddress, DishTextSearch } from '@/application/ports/dish-text-search';
import type { EmbeddingsPort } from '@/application/ports/embeddings-port';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeEmbeddingRepository } from '@/application/ports/recipe-embedding-repository';
import { EMBEDDING_VARIANT } from '@/application/use-cases/embed-recipes';
import type { Meal, MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { toUnits, type ScoredDish, type ScoredMenu, type Unit } from '@/domain/search/constraint-unit';
import { filterByHardUnits, type HardFilter } from '@/domain/search/hard-constraints';
import { rankMenus, type Ranking } from '@/domain/search/rank-menus';
import { scoreMenu } from '@/domain/search/score-menu';
import {
  findRequestIssues,
  type Constraint,
  type RequestIssue,
  type SearchRequest,
} from '@/domain/search/search-request';
import { hybridScore, rescaleSimilarities } from '@/domain/search/term-score';
import { err, ok, type Result } from '@/shared/result';

export type SearchMenusDeps = {
  menus: MenuRepository;
  dishText: DishTextSearch;
  recipeEmbeddings: RecipeEmbeddingRepository;
  embeddings: EmbeddingsPort;
};

/** The score of every dish for one term, keyed by dish address; a dish that is not there scores 0. */
type TermScores = Map<string, number>;

const INDEX_NOT_LOADED: SearchMenusError = {
  kind: 'index-not-loaded',
  message: 'no recipe embeddings are stored: run `pnpm ingest embed` first',
};

/** Limits of the structure (spec menu-search, "Request structure"), so that a request cannot exhaust the quota or the memory. */
const MAX_CONSTRAINTS = 12;
const MAX_TERM_LENGTH = 100;

const constraintSchema = z.strictObject({
  id: z.string().min(1),
  type: z.enum(['literal', 'exclusion', 'attribute', 'fuzzy']),
  term: z.string().trim().min(1).max(MAX_TERM_LENGTH),
  polarity: z.enum(['include', 'exclude']),
  hard: z.boolean(),
  slot: z.enum(['lunch', 'dinner']).optional(),
});

// The schema must accept exactly the shape of the DTO: `satisfies` breaks the build if they drift apart.
const searchRequestSchema = z.strictObject({
  constraints: z.array(constraintSchema).min(1).max(MAX_CONSTRAINTS),
  sameDish: z.array(z.array(z.string())).default([]),
  anyOf: z.array(z.array(z.string())).default([]),
}) satisfies z.ZodType<unknown, SearchRequestDto>;

type ValidDto = z.output<typeof searchRequestSchema>;

/**
 * Scores the menus against a typed structure with one strategy and returns the five best, the ties with the first
 * one and the menus each hard constraint removes (spec menu-search). Read only; the only model call is the
 * embedding of the terms, once per distinct term, and never with the lexical strategy.
 */
export async function searchMenus(
  dto: SearchRequestDto,
  strategy: SearchStrategy,
  deps: SearchMenusDeps,
): Promise<Result<SearchResultDto, SearchMenusError>> {
  const request = parseSearchRequest(dto);
  if (!request.ok) return request;
  const catalog = await deps.menus.list();
  if (!catalog.ok) return failed(catalog.error.reason);
  const terms = distinctTerms(request.value);
  const scores = await scoreTerms(terms, strategy, deps);
  if (!scores.ok) return scores;
  const menus = catalog.value.map((menu) => toScoredMenu(menu, request.value.constraints, terms, scores.value));
  return ok(rank(menus, toUnits(request.value), strategy));
}

/**
 * Validates the DTO before any query and turns it into the domain request. The shape is checked first; the
 * rules across constraints and groups run only on a well-formed shape, so a rejected DTO names the fields of the
 * first stage that fails. The DTO comes from outside, so its type is a contract, not a guarantee.
 */
export function parseSearchRequest(dto: SearchRequestDto): Result<SearchRequest, SearchRequestError> {
  const parsed = searchRequestSchema.safeParse(dto);
  if (!parsed.success) return invalid(parsed.error.issues.map((issue) => toIssue(dto, issue)));
  const request = toSearchRequest(parsed.data);
  const issues = findRequestIssues(request);
  return issues.length > 0 ? invalid(issues) : ok(request);
}

// Names the field that failed; for a constraint, its id too, read from the unvalidated DTO.
function toIssue(dto: unknown, issue: z.core.$ZodIssue): RequestIssue {
  const keys = issue.code === 'unrecognized_keys' ? issue.keys.join(', ') : undefined;
  const [first, position, ...rest] = issue.path;
  if (first === 'constraints' && typeof position === 'number') {
    const field = keys ?? (rest.length > 0 ? rest.join('.') : 'constraints');
    return { constraint: constraintIdAt(dto, position), field, message: issue.message };
  }
  return { field: keys ?? (first === undefined ? 'structure' : String(first)), message: issue.message };
}

function constraintIdAt(dto: unknown, position: number): string {
  const constraints = (dto as { constraints?: unknown[] }).constraints;
  const id = (constraints?.[position] as { id?: unknown } | undefined)?.id;
  return typeof id === 'string' ? id : `#${position}`;
}

function invalid(issues: RequestIssue[]): Result<never, SearchRequestError> {
  return err({ kind: 'invalid-request', issues });
}

function toSearchRequest({ constraints, sameDish, anyOf }: ValidDto): SearchRequest {
  return { constraints: constraints.map(toConstraint), sameDish, anyOf };
}

function toConstraint({ id, type, term, polarity, hard, slot }: ValidDto['constraints'][number]): Constraint {
  return slot === undefined ? { id, type, term, polarity, hard } : { id, type, term, polarity, hard, slot };
}

// A failure of any port ends the search: there is never a partial ranking.
function failed(reason: string): Result<never, SearchMenusError> {
  return err({ kind: 'search-failed', reason });
}

// A term in two constraints is matched and embedded once.
function distinctTerms({ constraints }: SearchRequest): string[] {
  return [...new Set(constraints.map((constraint) => constraint.term))];
}

// Each strategy calls only the ports it needs: the lexical one never reaches the embedding service.
async function scoreTerms(
  terms: string[],
  strategy: SearchStrategy,
  deps: SearchMenusDeps,
): Promise<Result<TermScores[], SearchMenusError>> {
  if (strategy === 'lexical') return lexicalScores(terms, deps.dishText);
  const semantic = await semanticScores(terms, deps);
  if (strategy === 'semantic' || !semantic.ok) return semantic;
  const lexical = await lexicalScores(terms, deps.dishText);
  if (!lexical.ok) return lexical;
  return ok(lexical.value.map((scores, index) => combineHybrid(scores, semantic.value[index])));
}

async function lexicalScores(terms: string[], dishText: DishTextSearch): Promise<Result<TermScores[], SearchMenusError>> {
  const scores: TermScores[] = [];
  for (const term of terms) {
    const matched = await dishText.matches(term);
    if (!matched.ok) return failed(matched.error.reason);
    scores.push(new Map(matched.value.map((dish) => [addressKey(dish), 1])));
  }
  return ok(scores);
}

async function semanticScores(
  terms: string[],
  { embeddings, recipeEmbeddings }: SearchMenusDeps,
): Promise<Result<TermScores[], SearchMenusError>> {
  const vectors = await embeddings.embedQueries(terms);
  if (!vectors.ok) return failed(vectors.error.reason);
  if (vectors.value.length !== terms.length) {
    return failed(`the service returned ${vectors.value.length} vectors for ${terms.length} terms`);
  }
  const scores: TermScores[] = [];
  for (const vector of vectors.value) {
    const found = await recipeEmbeddings.similarities(EMBEDDING_VARIANT, vector);
    if (!found.ok) return failed(found.error.reason);
    if (found.value.length === 0) return err(INDEX_NOT_LOADED);
    const rescaled = rescaleSimilarities(found.value.map(({ similarity }) => similarity));
    scores.push(new Map(found.value.map(({ dish }, index) => [addressKey(dish), rescaled[index]])));
  }
  return ok(scores);
}

function combineHybrid(lexical: TermScores, semantic: TermScores): TermScores {
  const keys = new Set([...lexical.keys(), ...semantic.keys()]);
  return new Map([...keys].map((key) => [key, hybridScore(scoreAt(lexical, key), scoreAt(semantic, key))]));
}

function addressKey({ menu, day, meal, position }: DishAddress): string {
  return `${menu}/${day}/${meal}/${position}`;
}

function scoreAt(scores: TermScores, key: string): number {
  return scores.get(key) ?? 0;
}

function toScoredMenu(
  { number, meals }: WeeklyMenu,
  constraints: Constraint[],
  terms: string[],
  scores: TermScores[],
): ScoredMenu {
  const byConstraint = constraints.map(({ id, term }) => [id, scores[terms.indexOf(term)]] as const);
  return { menu: number, dishes: meals.flatMap((meal) => meal.dishes.map((dish) => toScoredDish(number, meal, dish, byConstraint))) };
}

function toScoredDish(
  menu: number,
  { day, type }: Meal,
  { position, name }: MenuDish,
  byConstraint: (readonly [string, TermScores])[],
): ScoredDish {
  const key = addressKey({ menu, day, meal: type, position });
  const scores = Object.fromEntries(byConstraint.map(([id, termScores]) => [id, scoreAt(termScores, key)]));
  return { day, meal: type, position, name, scores };
}

function rank(menus: ScoredMenu[], units: Unit[], strategy: SearchStrategy): SearchResultDto {
  const filter = filterByHardUnits(menus, units, strategy);
  const ranking = rankMenus(filter.kept.map((menu) => scoreMenu(menu, units, strategy)));
  return toResultDto(strategy, units, ranking, filter);
}

// The result is a DTO of its own: the domain types never leave the use case.
function toResultDto(
  strategy: SearchStrategy,
  units: Unit[],
  { top, tiedWithFirst, ranked }: Ranking,
  { removedBy }: HardFilter,
): SearchResultDto {
  return {
    strategy,
    menus: top.map(({ menu, score, units: unitScores }) => ({
      menu,
      score,
      evidence: unitScores.map(({ evidence }, index) => ({
        constraints: units[index].members.map((member) => member.id),
        dish: evidence && toDishDto(evidence),
      })),
    })),
    tiedWithFirst,
    ranked: ranked.map(({ menu, score }) => ({ menu, score })),
    removedBy: removedBy.map(({ constraints, menusRemoved }) => ({ constraints, menusRemoved })),
  };
}

function toDishDto({ day, meal, position, name }: ScoredDish) {
  return { day, meal, position, name };
}
