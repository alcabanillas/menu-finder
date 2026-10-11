import { describe, expect, it } from 'vitest';
import type {
  DecomposerEvaluation,
  EvaluateDecomposerError,
  ModelReport,
} from '@/application/dto/decomposer-evaluation';
import { runEvaluateDecomposer } from '@/cli/commands/evaluate-decomposer';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const REPORT_PATH = 'evals/decomposer/results.md';

const modelReport = (model: string): ModelReport => ({
  model,
  constraints: [
    { kind: 'literal', hits: 2, answered: 4, expected: 5, precision: 0.5, recall: 0.4 },
    { kind: 'overall', hits: 2, answered: 4, expected: 5, precision: 0.5, recall: 0.4 },
  ],
  hard: { matching: 2, of: 2, share: 1 },
  slot: { matching: 1, of: 2, share: 0.5 },
  groups: [
    { kind: 'sameDish', hits: 1, answered: 1, expected: 2, precision: 1, recall: 0.5 },
    { kind: 'anyOf', hits: 0, answered: 0, expected: 0, precision: null, recall: null },
  ],
  rejections: [{ category: 'gibberish', hits: 3, total: 3 }],
  rejectedSearches: ['L07'],
  invalidAnswers: [],
  failedCalls: ['R02'],
  latency: {
    meanMs: 812.4,
    p95Ms: 1900,
    maxMs: 2400,
    slowest: [
      { id: 'X07', ms: 2400 },
      { id: 'R03', ms: 1900 },
    ],
  },
});

const EVALUATION: DecomposerEvaluation = {
  report: { requests: 71, models: [modelReport('gemini-3.5-flash-lite'), modelReport('gemini-3.8-flash')] },
  details: [
    {
      id: 'L01',
      model: 'gemini-3.5-flash-lite',
      expected: 'search',
      answer: 'structure',
      notFound: [{ term: 'garbanzos', type: 'literal', polarity: 'include' }],
      missed: [{ term: 'garbanzo', type: 'literal', polarity: 'include' }],
    },
  ],
};

const run = async (outcome: Result<DecomposerEvaluation, EvaluateDecomposerError | MissingVariables>) => {
  const lines: string[] = [];
  const written: { path: string; content: string }[] = [];
  const exitCode = await runEvaluateDecomposer({
    evaluateDecomposer: async () => outcome,
    reportPath: REPORT_PATH,
    writeFile: async (path, content) => {
      written.push({ path, content });
    },
    print: (line) => lines.push(line),
  });
  return { exitCode, output: lines.join('\n'), written };
};

describe('runEvaluateDecomposer', () => {
  it('writes the report with one column per model and exits with 0', async () => {
    const { exitCode, written } = await run(ok(EVALUATION));

    expect(exitCode).toBe(0);
    expect(written.map(({ path }) => path)).toEqual([REPORT_PATH]);
    expect(written[0].content).toContain('| Type | gemini-3.5-flash-lite | gemini-3.8-flash |');
    expect(written[0].content).toContain('P 0.500 · R 0.400 (2/4/5)');
    expect(written[0].content).toContain('R02');
  });

  it('writes the 95th percentile and the slowest requests of each model', async () => {
    const { written } = await run(ok(EVALUATION));

    expect(written[0].content).toContain('| 95th percentile | 1900 ms | 1900 ms |');
    expect(written[0].content).toContain('| slowest requests | X07 2400 ms, R03 1900 ms | X07 2400 ms, R03 1900 ms |');
  });

  it('writes no term of the golden set into the report', async () => {
    const { written } = await run(ok(EVALUATION));

    expect(written[0].content).not.toContain('garbanzo');
  });

  it('prints the misses of each request with their terms', async () => {
    const { output } = await run(ok(EVALUATION));

    expect(output).toContain('L01 gemini-3.5-flash-lite');
    expect(output).toContain('not found: garbanzos (literal, include)');
    expect(output).toContain('missed: garbanzo (literal, include)');
  });

  it('names a missing variable, writes nothing and exits with 1', async () => {
    const { exitCode, output, written } = await run(err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }));

    expect(exitCode).toBe(1);
    expect(output).toContain('GEMINI_API_KEY');
    expect(written).toEqual([]);
  });

  it('names an unreadable golden set, writes nothing and exits with 1', async () => {
    const { exitCode, output, written } = await run(
      err({ kind: 'golden-set-invalid', file: 'evals/decomposer/golden-set.json', reason: 'cannot read the file' }),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain('evals/decomposer/golden-set.json');
    expect(written).toEqual([]);
  });

  it('redacts a secret from a printed line', async () => {
    const { output } = await run(
      err({ kind: 'golden-set-invalid', file: 'evals/decomposer/golden-set.json', reason: 'via postgres://owner:s3cret@db.example.test/x' }),
    );

    expect(output).not.toContain('s3cret');
  });
});
