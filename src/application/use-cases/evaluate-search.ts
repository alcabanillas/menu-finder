import type { SearchRequestDto, SearchRequestIssue } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import type {
  EvaluateSearchError,
  Evaluation,
  EvaluationReport,
} from '@/application/dto/evaluation-report';
import type { EmbeddingsPort } from '@/application/ports/embeddings-port';
import type { GoldenSets, GoldenSetSource, GradedQuery, QueryType } from '@/application/ports/golden-set-source';
import { parseSearchRequest, searchMenus, type SearchMenusDeps } from '@/application/use-cases/search-menus';
import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { MIN_MENU_SCORE } from '@/domain/search/rank-menus';
import { hitAt5, ndcgAt5 } from '@/domain/search/ranking-metrics';
import { HYBRID_WEIGHT, MATCH_THRESHOLD } from '@/domain/search/term-score';
import { err, ok, type Result } from '@/shared/result';

export type EvaluateSearchDeps = SearchMenusDeps & { goldenSets: GoldenSetSource };

/** A kept query with its expected structure, validated as a search. */
type Input = { query: GradedQuery; structure: SearchRequestDto };

/** One search of the run. */
type Run = { query: GradedQuery; result: SearchResultDto };

type QueryScore = EvaluationReport['queries'][number];

/** The embeddings port of the run, which also tells the size of the vectors it returned. */
type MemoizedEmbeddings = EmbeddingsPort & { dimensions: () => number };

const STRATEGIES: SearchStrategy[] = ['lexical', 'semantic', 'hybrid'];
const QUERY_TYPES: QueryType[] = ['literal', 'exclusion', 'attribute', 'fuzzy', 'combined'];

const SEARCH_FAILED = 'search-failed';

const MENUS_NOT_LOADED = 'no menus are stored: run `pnpm ingest menu` first';

/**
 * Runs the three strategies on the expected structure of every kept query of the golden sets and measures each
 * ranking against the grades of the query (spec search-evaluation). Every input is checked before any search, each
 * term is embedded once per run (design D2), and nothing is written.
 */
export async function evaluateSearch(deps: EvaluateSearchDeps): Promise<Result<Evaluation, EvaluateSearchError>> {
  const goldenSets = await deps.goldenSets.read();
  if (!goldenSets.ok) return goldenSets;
  const inputs = pairInputs(goldenSets.value);
  if (!inputs.ok) return inputs;
  const catalog = await readCatalog(deps);
  if (!catalog.ok) return catalog;
  const graded = checkGrades(inputs.value, catalog.value);
  if (!graded.ok) return graded;
  const embeddings = memoizeQueries(deps.embeddings);
  const runs = await runSearches(inputs.value, { ...deps, menus: fixedCatalog(catalog.value), embeddings });
  if (!runs.ok) return runs;
  return ok({ report: buildReport(runs.value, embeddings), details: runs.value.map(toDetail) });
}

// A withdrawn query is not evaluated, so it needs no structure.
function pairInputs({ queries, structures }: GoldenSets): Result<Input[], EvaluateSearchError> {
  const byId = new Map(structures.map(({ id, structure }) => [id, structure]));
  const inputs: Input[] = [];
  for (const query of queries.filter(({ status }) => status === 'kept')) {
    const structure = byId.get(query.id);
    if (!structure) return invalidInput(query.id, 'no structure in the decomposer golden set');
    const parsed = parseSearchRequest(structure);
    if (!parsed.ok) return invalidInput(query.id, `invalid structure: ${parsed.error.issues.map(issueText).join('; ')}`);
    inputs.push({ query, structure });
  }
  return ok(inputs);
}

function issueText({ constraint, field, message }: SearchRequestIssue): string {
  const where = constraint === undefined ? field : [constraint, field].join('.');
  return `${where} ${message}`;
}

function invalidInput(id: string, problem: string): Result<never, EvaluateSearchError> {
  return err({ kind: 'invalid-input', id, problem });
}

async function readCatalog({ menus }: EvaluateSearchDeps): Promise<Result<WeeklyMenu[], EvaluateSearchError>> {
  const catalog = await menus.list();
  if (!catalog.ok) return err(searchFailed(catalog.error.reason));
  if (catalog.value.length === 0) return err({ kind: 'index-not-loaded', message: MENUS_NOT_LOADED });
  return catalog;
}

// Every loaded menu needs a grade, or the ideal order of the query would be wrong.
function checkGrades(inputs: Input[], catalog: WeeklyMenu[]): Result<void, EvaluateSearchError> {
  for (const { query } of inputs) {
    const ungraded = catalog.filter(({ number }) => !query.grades.has(number)).map(({ number }) => `menu ${number}`);
    if (ungraded.length > 0) return invalidInput(query.id, `no grade for ${ungraded.join(', ')}`);
  }
  return ok(undefined);
}

/** Embeds a term only the first time the run asks for it; a failure is never stored. */
function memoizeQueries(inner: EmbeddingsPort): MemoizedEmbeddings {
  const vectors = new Map<string, number[]>();
  return {
    model: inner.model,
    embedDocuments: inner.embedDocuments.bind(inner),
    embedQueries: async (terms) => {
      const missing = [...new Set(terms.filter((term) => !vectors.has(term)))];
      const embedded = missing.length > 0 ? await inner.embedQueries(missing) : ok([]);
      if (!embedded.ok) return embedded;
      embedded.value.forEach((vector, index) => vectors.set(missing[index], vector));
      // A term the service returned no vector for is left out, so `searchMenus` sees the count is wrong.
      return ok(terms.flatMap((term) => (vectors.has(term) ? [vectors.get(term)!] : [])));
    },
    dimensions: () => vectors.values().next().value?.length ?? 0,
  };
}

// The catalog is read once for the whole run, not once per search.
function fixedCatalog(catalog: WeeklyMenu[]): SearchMenusDeps['menus'] {
  return { list: async () => ok(catalog) };
}

async function runSearches(inputs: Input[], deps: SearchMenusDeps): Promise<Result<Run[], EvaluateSearchError>> {
  const runs: Run[] = [];
  for (const { query, structure } of inputs) {
    for (const strategy of STRATEGIES) {
      const result = await searchMenus(structure, strategy, deps);
      if (!result.ok) return err(searchError(query.id, result.error));
      runs.push({ query, result: result.value });
    }
  }
  return ok(runs);
}

function searchError(id: string, error: SearchMenusError): EvaluateSearchError {
  switch (error.kind) {
    case 'index-not-loaded':
      return error;
    case SEARCH_FAILED:
      return searchFailed(error.reason, id);
    // Unreachable: every structure was validated by `pairInputs` before the run. Mapped for exhaustiveness only.
    /* v8 ignore next 2 */
    case 'invalid-request':
      return { kind: 'invalid-input', id, problem: 'invalid structure' };
  }
}

function searchFailed(reason: string, id?: string): EvaluateSearchError {
  return id === undefined ? { kind: SEARCH_FAILED, reason } : { kind: SEARCH_FAILED, id, reason };
}

function buildReport(runs: Run[], embeddings: MemoizedEmbeddings): EvaluationReport {
  const queries = runs.map(scoreRun);
  return {
    parameters: {
      embeddingModel: embeddings.model,
      dimensions: embeddings.dimensions(),
      hybridWeight: HYBRID_WEIGHT,
      matchThreshold: { ...MATCH_THRESHOLD },
      minMenuScore: MIN_MENU_SCORE,
    },
    cells: buildCells(queries),
    queries,
    withoutRelevant: [...new Set(queries.filter(({ ndcg }) => ndcg === null).map(({ id }) => id))],
  };
}

function scoreRun({ query: { id, type, grades }, result: { strategy, ranked } }: Run): QueryScore {
  return { id, type, strategy, ndcg: ndcgAt5(ranked, grades), hit: hitAt5(ranked, grades), empty: ranked.length === 0 };
}

// The types in a fixed order, only those with queries, and then all of them together.
function buildCells(queries: QueryScore[]): EvaluationReport['cells'] {
  const types = QUERY_TYPES.filter((type) => queries.some((score) => score.type === type));
  return [...types, 'overall' as const].flatMap((type) =>
    STRATEGIES.map((strategy) => {
      const scores = queries.filter((score) => score.strategy === strategy && (type === 'overall' || score.type === type));
      const ndcg = present(scores.map((score) => score.ndcg));
      const hit = present(scores.map((score) => score.hit));
      return { type, strategy, ndcg: mean(ndcg), ndcgQueries: ndcg.length, hit: mean(hit), hitQueries: hit.length };
    }),
  );
}

function present(values: (number | null)[]): number[] {
  return values.filter((value): value is number => value !== null);
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDetail({ query: { id }, result }: Run) {
  return { id, result };
}
