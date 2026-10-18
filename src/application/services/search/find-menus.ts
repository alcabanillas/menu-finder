import { parseSearchRequest, type SearchRequestDto } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import type { DishAddress, DishTextSearch } from '@/application/ports/dish-text-search';
import type { EmbeddingsPort } from '@/application/ports/embeddings-port';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeEmbeddingRepository } from '@/application/ports/recipe-embedding-repository';
import type { Meal, MenuDish, WeeklyMenu } from '@/domain/menu/weekly-menu';
import { isWeekWideExclusion, toUnits, type ScoredDish, type ScoredMenu, type Unit } from '@/domain/search/constraint-unit';
import { EMBEDDING_VARIANT } from '@/domain/search/embedding-text';
import { filterByHardUnits, type HardFilter } from '@/domain/search/hard-constraints';
import { rankMenus, type Ranking } from '@/domain/search/rank-menus';
import { scoreMenu } from '@/domain/search/score-menu';
import type { Constraint, SearchRequest } from '@/domain/search/search-request';
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

/** The terms scored with the strategy, and those of the week-wide exclusions, always matched by text. */
type Terms = { scored: string[]; excluded: string[]; excludedIds: Set<string> };

const INDEX_NOT_LOADED: SearchMenusError = {
  kind: 'index-not-loaded',
  message: 'no recipe embeddings are stored: run `pnpm ingest embed` first',
};

/**
 * Scores the menus against a typed structure with one strategy and returns the five best, the ties with the first
 * one and the menus each filter removes (spec menu-search). A week-wide exclusion is always matched by text, whatever
 * the strategy (BUS-superficie-consulta (b)). Read only; the only model call is the embedding of the scored terms, once
 * per distinct term, and never with the lexical strategy.
 */
export async function findMenus(
  dto: SearchRequestDto,
  strategy: SearchStrategy,
  deps: FindMenusDeps,
): Promise<Result<SearchResultDto, SearchMenusError>> {
  const request = parseSearchRequest(dto);
  if (!request.ok) return request;
  const catalog = await deps.menus.list();
  if (!catalog.ok) return failed(catalog.error.reason);
  const units = toUnits(request.value);
  const terms = splitTerms(request.value, units);
  const scores = await scoreTerms(terms.scored, strategy, deps);
  if (!scores.ok) return scores;
  const exclusions = await lexicalScores(terms.excluded, deps.dishText);
  if (!exclusions.ok) return exclusions;
  const scoresOf = scoresByConstraint(terms, scores.value, exclusions.value);
  const menus = catalog.value.map((menu) => toScoredMenu(menu, request.value.constraints, scoresOf));
  return ok(rank(menus, units, strategy));
}

// A term in two constraints is matched and embedded once.
function splitTerms({ constraints }: SearchRequest, units: Unit[]): Terms {
  const excludedIds = new Set(units.filter(isWeekWideExclusion).map(({ members: [member] }) => member.id));
  return {
    scored: distinctTerms(constraints.filter(({ id }) => !excludedIds.has(id))),
    excluded: distinctTerms(constraints.filter(({ id }) => excludedIds.has(id))),
    excludedIds,
  };
}

function distinctTerms(constraints: Constraint[]): string[] {
  return [...new Set(constraints.map(({ term }) => term))];
}

function scoresByConstraint({ scored, excluded, excludedIds }: Terms, scores: TermScores[], exclusions: TermScores[]) {
  return ({ id, term }: Constraint): TermScores =>
    excludedIds.has(id) ? exclusions[excluded.indexOf(term)] : scores[scored.indexOf(term)];
}

// A failure of any port ends the search: there is never a partial ranking.
function failed(reason: string): Result<never, SearchMenusError> {
  return err({ kind: 'search-failed', reason });
}

// Each strategy calls only the ports it needs: the lexical one never reaches the embedding service, and no strategy
// does when every term is a week-wide exclusion.
async function scoreTerms(
  terms: string[],
  strategy: SearchStrategy,
  deps: FindMenusDeps,
): Promise<Result<TermScores[], SearchMenusError>> {
  if (strategy === 'lexical' || terms.length === 0) return lexicalScores(terms, deps.dishText);
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
  { embeddings, recipeEmbeddings }: FindMenusDeps,
): Promise<Result<TermScores[], SearchMenusError>> {
  const vectors = await embeddings.embedQueries(terms);
  if (!vectors.ok) return err({ kind: 'embedding-failed', reason: vectors.error.reason });
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
  scoresOf: (constraint: Constraint) => TermScores,
): ScoredMenu {
  const byConstraint = constraints.map((constraint) => [constraint.id, scoresOf(constraint)] as const);
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
  const ranking = rankMenus(filter.kept.map((menu) => scoreMenu(menu, units)));
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
