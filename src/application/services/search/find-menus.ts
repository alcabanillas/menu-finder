import { parseSearchRequest, type SearchRequestDto } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import type { DishAddress, DishTextMatchOptions, DishTextSearch } from '@/application/ports/dish-text-search';
import type { EmbeddingsPort } from '@/application/ports/embeddings-port';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeEmbeddingRepository } from '@/application/ports/recipe-embedding-repository';
import type { Meal, MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { isWeekWideExclusion, toUnits, type ScoredDish, type ScoredMenu, type Unit } from '@/domain/search/constraint-unit';
import { EMBEDDING_VARIANT } from '@/domain/search/embedding-text';
import { filterByHardUnits, type HardFilter } from '@/domain/search/hard-constraints';
import { rankMenus, type Ranking } from '@/domain/search/rank-menus';
import { scoreMenu } from '@/domain/search/score-menu';
import type { Constraint } from '@/domain/search/search-request';
import { hybridScore, rescaleSimilarities } from '@/domain/search/term-score';
import { err, ok, type Result } from '@/shared/result';

export type FindMenusDeps = {
  menus: Pick<MenuRepository, 'list'>;
  dishText: DishTextSearch;
  recipeEmbeddings: RecipeEmbeddingRepository;
  embeddings: EmbeddingsPort;
};

/** The score of every dish for one term, keyed by dish address; a dish that is not there scores 0. */
type TermScores = Map<string, number>;

/** The term scores of each term, keyed by the term. */
type ScoresByTerm = Map<string, TermScores>;

/** The term scores of each term with the strategy, and its text match (1 or 0), which tells the literal dishes. */
type TermEvidence = { scores: ScoresByTerm; literal: ScoresByTerm };

/** The term scores and the text match of each constraint, keyed by the constraint id. */
type ScoresByConstraint = { scores: Map<string, TermScores>; literal: Map<string, TermScores> };

type Scored<T> = Promise<Result<T, SearchMenusError>>;

const INDEX_NOT_LOADED: SearchMenusError = {
  kind: 'index-not-loaded',
  message: 'no recipe embeddings are stored: run `pnpm ingest embed` first',
};

/**
 * Scores the menus against a typed structure with one strategy and returns the five best, the ties with the first
 * one and the menus each filter removes (spec menu-search). Read only; the only model call is the embedding of the
 * terms scored with the strategy, once per distinct term, and never with the lexical strategy.
 */
export async function findMenus(dto: SearchRequestDto, strategy: SearchStrategy, deps: FindMenusDeps): Scored<SearchResultDto> {
  const request = parseSearchRequest(dto);
  if (!request.ok) return request;
  const catalog = await deps.menus.list();
  if (!catalog.ok) return failed(catalog.error.reason);
  const units = toUnits(request.value);
  const scores = await scoreConstraints(request.value.constraints, units, strategy, deps);
  if (!scores.ok) return scores;
  const menus = catalog.value.map((menu) => toScoredMenu(menu, scores.value));
  return ok(rank(menus, units, strategy));
}

// A failure of any port ends the search: there is never a partial ranking.
function failed(reason: string): Result<never, SearchMenusError> {
  return err({ kind: 'search-failed', reason });
}

// A week-wide exclusion is matched by text whatever the strategy (BUS-superficie-consulta (b)); every other constraint
// is scored with the strategy. A term in two constraints is matched and embedded once.
async function scoreConstraints(
  constraints: Constraint[],
  units: Unit[],
  strategy: SearchStrategy,
  deps: FindMenusDeps,
): Scored<ScoresByConstraint> {
  const excluded = new Set(units.filter(isWeekWideExclusion).map(({ members: [member] }) => member.id));
  const weekWideExclusions = constraints.filter(({ id }) => excluded.has(id));
  const otherConstraints = constraints.filter(({ id }) => !excluded.has(id));
  const [otherScores, exclusionScores] = await Promise.all([
    scoreTerms(distinctTerms(otherConstraints), strategy, deps),
    lexicalScores(distinctTerms(weekWideExclusions), deps.dishText, { includeIngredientGroups: false }),
  ]);
  if (!otherScores.ok) return otherScores;
  if (!exclusionScores.ok) return exclusionScores;
  const exclusions = { scores: exclusionScores.value, literal: exclusionScores.value };
  const groupedIds = groupedConstraintIds(units);
  return ok(byConstraint(constraints, groupedIds, strategy, (id) => (excluded.has(id) ? exclusions : otherScores.value)));
}

function groupedConstraintIds(units: Unit[]): Set<string> {
  return new Set(
    units.filter((unit) => unit.kind !== 'constraint').flatMap((unit) => unit.members.map((member) => member.id)),
  );
}

// Each constraint takes the scores and the text match of its term from the evidence it was scored with.
// Under semantic, literal and grouped constraints take the maximum of semantic and lexical score (BUS-superficie-consulta (d)).
function byConstraint(
  constraints: Constraint[],
  groupedIds: ReadonlySet<string>,
  strategy: SearchStrategy,
  evidenceOf: (id: string) => TermEvidence,
): ScoresByConstraint {
  const scores = new Map<string, TermScores>();
  const literal = new Map<string, TermScores>();
  for (const constraint of constraints) {
    const { id, term } = constraint;
    const evidence = evidenceOf(id);
    const lexical = scoresOf(evidence.literal, term);
    const raw = scoresOf(evidence.scores, term);
    scores.set(id, strategy === 'semantic' && usesLexicalMax(constraint, groupedIds) ? maxPool(raw, lexical) : raw);
    literal.set(id, lexical);
  }
  return { scores, literal };
}

function usesLexicalMax(constraint: Constraint, groupedIds: ReadonlySet<string>): boolean {
  return constraint.type === 'literal' || groupedIds.has(constraint.id);
}

function maxPool(semantic: TermScores, lexical: TermScores): TermScores {
  const keys = new Set([...semantic.keys(), ...lexical.keys()]);
  return new Map([...keys].map((key) => [key, Math.max(scoreAt(semantic, key), scoreAt(lexical, key))]));
}

// The terms of the constraints without repeats, so that each one is matched and embedded once.
function distinctTerms(constraints: Constraint[]): string[] {
  return [...new Set(constraints.map(({ term }) => term))];
}

// Every term is scored before it is looked up, so it is always in the map.
function scoresOf(byTerm: ScoresByTerm, term: string): TermScores {
  return byTerm.get(term) as TermScores;
}

// Each strategy calls only the ports it needs: the lexical one never reaches the embedding service, and no strategy
// does when there is no term to score. Every strategy matches the text too, to tell the literal dishes (MF-61 design D2).
async function scoreTerms(terms: string[], strategy: SearchStrategy, deps: FindMenusDeps): Scored<TermEvidence> {
  if (strategy === 'lexical' || terms.length === 0) {
    const lexical = await lexicalScores(terms, deps.dishText);
    return lexical.ok ? ok({ scores: lexical.value, literal: lexical.value }) : lexical;
  }
  const [semantic, lexical] = await Promise.all([semanticScores(terms, deps), lexicalScores(terms, deps.dishText)]);
  if (!semantic.ok) return semantic;
  if (!lexical.ok) return lexical;
  if (strategy === 'semantic') return ok({ scores: semantic.value, literal: lexical.value });
  const hybrid = new Map(terms.map((term) => [term, combineHybrid(scoresOf(lexical.value, term), scoresOf(semantic.value, term))]));
  return ok({ scores: hybrid, literal: lexical.value });
}

async function lexicalScores(
  terms: string[],
  dishText: DishTextSearch,
  options?: DishTextMatchOptions,
): Scored<ScoresByTerm> {
  const scores: ScoresByTerm = new Map();
  for (const term of terms) {
    const matched = await dishText.matches(term, options);
    if (!matched.ok) return failed(matched.error.reason);
    scores.set(term, new Map(matched.value.map((dish) => [addressKey(dish), 1])));
  }
  return ok(scores);
}

async function semanticScores(terms: string[], { embeddings, recipeEmbeddings }: FindMenusDeps): Scored<ScoresByTerm> {
  const vectors = await embeddings.embedQueries(terms);
  if (!vectors.ok) return err({ kind: 'embedding-failed', reason: vectors.error.reason });
  if (vectors.value.length !== terms.length) {
    return failed(`the service returned ${vectors.value.length} vectors for ${terms.length} terms`);
  }
  const scores: ScoresByTerm = new Map();
  for (const [index, vector] of vectors.value.entries()) {
    const found = await recipeEmbeddings.similarities(EMBEDDING_VARIANT, vector);
    if (!found.ok) return failed(found.error.reason);
    if (found.value.length === 0) return err(INDEX_NOT_LOADED);
    const rescaled = rescaleSimilarities(found.value.map(({ similarity }) => similarity));
    scores.set(terms[index], new Map(found.value.map(({ dish }, at) => [addressKey(dish), rescaled[at]])));
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

function toScoredMenu({ number, meals }: WeeklyMenu, scores: ScoresByConstraint): ScoredMenu {
  return { menu: number, dishes: meals.flatMap((meal) => meal.dishes.map((dish) => toScoredDish(number, meal, dish, scores))) };
}

function toScoredDish(menu: number, { day, type }: Meal, { position, name }: MenuDish, scores: ScoresByConstraint): ScoredDish {
  const key = addressKey({ menu, day, meal: type, position });
  const byConstraint: Record<string, number> = {};
  for (const [id, termScores] of scores.scores) byConstraint[id] = scoreAt(termScores, key);
  const literal: Record<string, boolean> = {};
  for (const [id, termScores] of scores.literal) literal[id] = scoreAt(termScores, key) === 1;
  return { day, meal: type, position, name, scores: byConstraint, literal };
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
    units: units.map(({ kind, members }) => ({ kind, constraints: members.map((member) => member.id) })),
    menus: top.map(({ menu, score, units: unitScores }) => ({
      menu,
      score,
      evidence: unitScores.map(({ evidence, match }, index) => ({
        constraints: units[index].members.map((member) => member.id),
        dish: evidence && toDishDto(evidence),
        match,
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
