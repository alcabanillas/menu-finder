import { describe, expect, it } from 'vitest';
import type { EvaluateSearchError, Evaluation, EvaluationReport } from '@/application/dto/evaluation-report';
import type { SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import { runEvaluateSearch } from '@/cli/commands/evaluate-search';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const REPORT_PATH = 'evals/search/results.md';
const DISH_NAME = 'Pollo Tarlan';
const URL_WITH_PASSWORD = 'postgresql://owner:s3cr3t@ep-x.neon.tech/neondb';

const STRATEGIES: SearchStrategy[] = ['lexical', 'semantic', 'hybrid'];

function cell(type: EvaluationReport['cells'][number]['type'], strategy: SearchStrategy, ndcg: number | null) {
  return { type, strategy, ndcg, ndcgQueries: ndcg === null ? 0 : 1, hit: ndcg === null ? null : 1, hitQueries: ndcg === null ? 0 : 1 };
}

const REPORT: EvaluationReport = {
  parameters: {
    embeddingModel: 'test-model',
    dimensions: 3072,
    hybridWeight: 0.5,
    matchThreshold: { lexical: 0.5, semantic: 0.5, hybrid: 0.75 },
    minMenuScore: 0.6,
  },
  cells: [
    ...STRATEGIES.map((strategy, index) => cell('literal', strategy, 0.5 + index / 10)),
    ...STRATEGIES.map((strategy) => cell('attribute', strategy, null)),
    ...STRATEGIES.map((strategy, index) => cell('overall', strategy, 0.5 + index / 10)),
  ],
  queries: [
    ...STRATEGIES.map((strategy, index) => ({
      id: 'L01',
      type: 'literal' as const,
      strategy,
      ndcg: index === 0 ? 0 : 0.81234,
      hit: 1,
      empty: index === 0,
    })),
    ...STRATEGIES.map((strategy) => ({ id: 'A01', type: 'attribute' as const, strategy, ndcg: null, hit: null, empty: false })),
  ],
  withoutRelevant: ['A01'],
};

const RESULT: SearchResultDto = {
  strategy: 'hybrid',
  menus: [{ menu: 3, score: 1, evidence: [{ constraints: ['c1'], dish: { day: 'monday', meal: 'lunch', position: 1, name: DISH_NAME } }] }],
  tiedWithFirst: 1,
  ranked: [{ menu: 3, score: 1 }],
  removedBy: [],
};

const EVALUATION: Evaluation = { report: REPORT, details: [{ id: 'L01', result: RESULT }] };

type Outcome = Result<Evaluation, EvaluateSearchError | MissingVariables>;

async function evaluate(outcome: Outcome = ok(EVALUATION)) {
  const lines: string[] = [];
  const written: { path: string; content: string }[] = [];
  const code = await runEvaluateSearch({
    evaluateSearch: async () => outcome,
    reportPath: REPORT_PATH,
    writeFile: async (path, content) => {
      written.push({ path, content });
    },
    print: (line) => lines.push(line),
  });
  return { code, text: lines.join('\n'), written };
}

describe('runEvaluateSearch', () => {
  it('writes the report with one row per type and one column per strategy, each with its count', async () => {
    const { code, written } = await evaluate();

    expect(code).toBe(0);
    expect(written).toHaveLength(1);
    expect(written[0].path).toBe(REPORT_PATH);
    expect(written[0].content).toContain('| Type | lexical | semantic | hybrid |');
    expect(written[0].content).toContain('| literal | 0.5000 (n=1) | 0.6000 (n=1) | 0.7000 (n=1) |');
    expect(written[0].content).toContain('| attribute | – (n=0) | – (n=0) | – (n=0) |');
    expect(written[0].content).toContain('| overall | 0.5000 (n=1) | 0.6000 (n=1) | 0.7000 (n=1) |');
  });

  it('writes the nDCG@5 of every query, marking an empty ranking, and the queries without relevant menus', async () => {
    const { written } = await evaluate();

    expect(written[0].content).toContain('| L01 | literal | 0.0000 (empty) | 0.8123 | 0.8123 |');
    expect(written[0].content).toContain('| A01 | attribute | – | – | – |');
    expect(written[0].content).toMatch(/without relevant menus[\s\S]*A01/);
  });

  it('writes the parameters of the run', async () => {
    const { written } = await evaluate();

    expect(written[0].content).toContain('test-model');
    expect(written[0].content).toContain('3072');
    expect(written[0].content).toContain('lexical 0.5, semantic 0.5, hybrid 0.75');
  });

  it('prints the dish of each search to the console and never writes it to the report', async () => {
    const { text, written } = await evaluate();

    expect(text).toContain(DISH_NAME);
    expect(text).toContain(REPORT_PATH);
    expect(written[0].content).not.toContain(DISH_NAME);
  });

  it.each([
    [err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }), 'GEMINI_API_KEY'],
    [err({ kind: 'invalid-input', id: 'L01', problem: 'no structure in the decomposer golden set' }), 'L01'],
    [err({ kind: 'golden-set-invalid', file: 'evals/retrieval/golden-set.json', reason: 'not JSON' }), 'evals/retrieval/golden-set.json'],
    [err({ kind: 'index-not-loaded', message: 'no menus are stored: run `pnpm ingest menu` first' }), 'pnpm ingest menu'],
    [err({ kind: 'search-failed', id: 'L02', reason: 'quota exceeded' }), 'L02'],
  ] as [Outcome, string][])('exits with 1, names the problem and writes no report on %#', async (outcome, named) => {
    const { code, text, written } = await evaluate(outcome);

    expect(code).toBe(1);
    expect(text).toContain(named);
    expect(written).toEqual([]);
  });

  it('never prints a credential from an error', async () => {
    const { text } = await evaluate(err({ kind: 'search-failed', reason: `connect failed: ${URL_WITH_PASSWORD}` }));

    expect(text).not.toContain('s3cr3t');
  });
});
