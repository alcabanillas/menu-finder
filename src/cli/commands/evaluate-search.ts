import type { EvaluateSearchError, Evaluation, EvaluationReport, QueryDetail } from '@/application/dto/evaluation-report';
import type { SearchStrategy } from '@/application/dto/search-result';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type Print = (line: string) => void;

type EvaluationOutcome = Result<Evaluation, EvaluateSearchError | MissingVariables>;

export type RunEvaluateSearchDeps = {
  evaluateSearch: () => Promise<EvaluationOutcome>;
  reportPath: string;
  writeFile: (path: string, content: string) => Promise<void>;
  print: Print;
};

type Cell = EvaluationReport['cells'][number];
type QueryScore = EvaluationReport['queries'][number];

const STRATEGIES: SearchStrategy[] = ['lexical', 'semantic', 'hybrid'];
const DECIMALS = 4;
const NO_VALUE = '–';

/**
 * `ingest evaluate-search`: measures the three strategies against the golden sets, writes the report and prints the
 * dish of each search. The report holds ids and numbers only and is written only when the whole run succeeds (design D4).
 */
export async function runEvaluateSearch({ evaluateSearch, reportPath, writeFile, print }: RunEvaluateSearchDeps): Promise<number> {
  const result = await evaluateSearch();
  if (!result.ok) {
    errorLines(result.error).forEach((line) => print(redactSecrets(line)));
    return 1;
  }
  result.value.details.forEach((detail) => print(detailLine(detail)));
  await writeFile(reportPath, reportMarkdown(result.value.report));
  print(`Report written to ${reportPath}.`);
  return 0;
}

// The console is local, so it may name the dish that ranked first; the report never does.
function detailLine({ id, result: { strategy, menus, tiedWithFirst } }: QueryDetail): string {
  if (menus.length === 0) return `${id} ${strategy}: no menu is ranked`;
  const first = menus[0].evidence.map(({ dish }) => dish?.name ?? 'no dish').join(', ');
  const order = menus.map(({ menu }) => menu).join(', ');
  return `${id} ${strategy}: menus ${order} (tied with the first: ${tiedWithFirst}); first: ${first}`;
}

function reportMarkdown({ parameters, cells, queries, withoutRelevant }: EvaluationReport): string {
  return [
    '# Search evaluation (MF-14)',
    '',
    'Written by `pnpm ingest evaluate-search` (spec search-evaluation). Query ids and numbers only: no dish or ingredient text (SEG-datos-nutricionista).',
    '',
    'The number of queries behind each mean is in parentheses: per type they are small samples. Ties count by their mean grade (design D3), and hit@5 is the chance of a grade-2 menu in the top five.',
    '',
    '## Parameters',
    '',
    '| Parameter | Value |',
    '|---|---|',
    `| Embedding model | ${parameters.embeddingModel} |`,
    `| Dimensions | ${parameters.dimensions} |`,
    `| Hybrid weight of the semantic part | ${parameters.hybridWeight} |`,
    `| Match threshold | ${thresholds(parameters.matchThreshold)} |`,
    `| Minimum menu score | ${parameters.minMenuScore} |`,
    '',
    '## nDCG@5 by query type',
    '',
    ...cellTable(cells, ({ ndcg, ndcgQueries }) => `${formatted(ndcg)} (n=${ndcgQueries})`),
    '',
    '## hit@5 by query type',
    '',
    ...cellTable(cells, ({ hit, hitQueries }) => `${formatted(hit)} (n=${hitQueries})`),
    '',
    '## nDCG@5 per query',
    '',
    `| Query | Type | ${STRATEGIES.join(' | ')} |`,
    `|---|---|${STRATEGIES.map(() => '---').join('|')}|`,
    ...queryRows(queries),
    '',
    '## Queries without relevant menus',
    '',
    withoutRelevant.length === 0 ? 'None.' : `Left out of the means: ${withoutRelevant.join(', ')}.`,
    '',
  ].join('\n');
}

function thresholds(matchThreshold: Record<SearchStrategy, number>): string {
  return STRATEGIES.map((strategy) => [strategy, matchThreshold[strategy]].join(' ')).join(', ');
}

function cellTable(cells: Cell[], value: (cell: Cell) => string): string[] {
  const types = [...new Set(cells.map(({ type }) => type))];
  return [
    `| Type | ${STRATEGIES.join(' | ')} |`,
    `|---|${STRATEGIES.map(() => '---').join('|')}|`,
    ...types.map((type) => {
      const row = STRATEGIES.map((strategy) => value(cells.find((cell) => cell.type === type && cell.strategy === strategy)!));
      return `| ${type} | ${row.join(' | ')} |`;
    }),
  ];
}

function queryRows(queries: QueryScore[]): string[] {
  const ids = [...new Set(queries.map(({ id }) => id))];
  return ids.map((id) => {
    const scores = STRATEGIES.map((strategy) => queries.find((score) => score.id === id && score.strategy === strategy)!);
    return `| ${id} | ${scores[0].type} | ${scores.map(queryValue).join(' | ')} |`;
  });
}

function queryValue({ ndcg, empty }: QueryScore): string {
  return empty ? `${formatted(ndcg)} (empty)` : formatted(ndcg);
}

function formatted(value: number | null): string {
  return value === null ? NO_VALUE : value.toFixed(DECIMALS);
}

function errorLines(error: EvaluateSearchError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  const noReport = 'No report is written.';
  switch (error.kind) {
    case 'golden-set-invalid':
      return [`${error.file} is not a valid golden set: ${error.reason}`, noReport];
    case 'invalid-input':
      return [`Query ${error.id}: ${error.problem}`, noReport];
    case 'index-not-loaded':
      return [error.message, noReport];
    case 'search-failed':
      return [`The search failed${onQuery(error.id)}: ${error.reason}`, noReport];
  }
}

function onQuery(id: string | undefined): string {
  return id === undefined ? '' : ` on query ${id}`;
}
