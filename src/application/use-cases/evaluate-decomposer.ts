import type {
  ConstraintText,
  CountRow,
  DecomposerEvaluation,
  EvaluateDecomposerError,
  ModelReport,
  RequestDetail,
} from '@/application/dto/decomposer-evaluation';
import type { DecomposeError, RejectionCategory } from '@/application/dto/decomposition';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { DecomposerRequest, GoldenSetSource } from '@/application/ports/golden-set-source';
import type { RequestDecomposer } from '@/application/ports/request-decomposer';
import { decomposeRequest } from '@/application/use-cases/decompose-request';
import { groupHits, matchConstraints, type ConstraintPair } from '@/domain/search/decomposition-score';
import type { Constraint } from '@/domain/search/search-request';
import { ok, type Result } from '@/shared/result';

/** One model of the run, with its own decomposer (MF-40.3 design D3). */
type ModelDecomposer = { model: string; decomposer: RequestDecomposer };

export type EvaluateDecomposerDeps = {
  goldenSets: GoldenSetSource;
  models: ModelDecomposer[];
  /** A clock in milliseconds, for the latency. */
  now: () => number;
};

/** What came back for one request: invalid answers and failed calls score as no constraints (spec "Failed answers"). */
type Outcome =
  | { kind: 'structure'; structure: SearchRequestDto }
  | { kind: 'rejection'; category: RejectionCategory }
  | { kind: 'invalid' }
  | { kind: 'failed' };

type Run = { request: DecomposerRequest; outcome: Outcome; ms: number };

/** A run with its constraints paired: the answered ones, the expected ones and the hits. */
type Scored = Run & { expected: SearchRequestDto; answered: SearchRequestDto; pairs: ConstraintPair[] };

type ConstraintType = Constraint['type'];

const CONSTRAINT_TYPES: ConstraintType[] = ['literal', 'exclusion', 'attribute', 'fuzzy'];
const CATEGORIES: RejectionCategory[] = ['gibberish', 'off-topic', 'instruction', 'not-a-search'];
const NOTHING: SearchRequestDto = { constraints: [], sameDish: [], anyOf: [] };

/**
 * Sends every request of the decomposer golden set to each model, once, and compares the answer with its label
 * (spec decomposer-evaluation). Only an unreadable golden set stops the run: a failed call is a result.
 */
export async function evaluateDecomposer({
  goldenSets,
  models,
  now,
}: EvaluateDecomposerDeps): Promise<Result<DecomposerEvaluation, EvaluateDecomposerError>> {
  const read = await goldenSets.read();
  if (!read.ok) return read;
  const { requests } = read.value;
  const reports: ModelReport[] = [];
  const details: RequestDetail[] = [];
  for (const { model, decomposer } of models) {
    const scored = (await runModel(requests, decomposer, now)).map(score);
    reports.push(modelReport(model, scored));
    details.push(...scored.flatMap((run) => detailOf(model, run)));
  }
  return ok({ report: { requests: requests.length, models: reports }, details });
}

// One call after another, in the order of the golden set (design D3).
async function runModel(requests: DecomposerRequest[], decomposer: RequestDecomposer, now: () => number): Promise<Run[]> {
  const runs: Run[] = [];
  for (const request of requests) {
    const start = now();
    const result = await decomposeRequest(request.text, { decomposer });
    runs.push({ request, outcome: toOutcome(result), ms: now() - start });
  }
  return runs;
}

function toOutcome(result: Result<SearchRequestDto, DecomposeError>): Outcome {
  if (result.ok) return { kind: 'structure', structure: result.value };
  switch (result.error.kind) {
    case 'rejected':
      return { kind: 'rejection', category: result.error.category };
    case 'decomposer-failed':
      return { kind: 'failed' };
    default:
      return { kind: 'invalid' };
  }
}

function score(run: Run): Scored {
  const expected = run.request.expected.kind === 'search' ? run.request.expected.structure : NOTHING;
  const answered = run.outcome.kind === 'structure' ? run.outcome.structure : NOTHING;
  return { ...run, expected, answered, pairs: matchConstraints(expected.constraints, answered.constraints) };
}

function modelReport(model: string, runs: Scored[]): ModelReport {
  const pairs = runs.flatMap((run) => run.pairs);
  return {
    model,
    constraints: [...CONSTRAINT_TYPES, 'overall' as const].map((kind) => constraintRow(kind, runs)),
    hard: share(pairs, ({ expected, answered }) => expected.hard === answered.hard),
    slot: share(pairs, ({ expected, answered }) => expected.slot === answered.slot),
    groups: [groupRow('sameDish', runs), groupRow('anyOf', runs)],
    rejections: CATEGORIES.map((category) => rejectionRow(category, runs)),
    rejectedSearches: idsWhere(runs, ({ request, outcome }) => request.expected.kind === 'search' && outcome.kind === 'rejection'),
    invalidAnswers: idsWhere(runs, ({ outcome }) => outcome.kind === 'invalid'),
    failedCalls: idsWhere(runs, ({ outcome }) => outcome.kind === 'failed'),
    latency: latency(runs.map(({ ms }) => ms)),
  };
}

function constraintRow(kind: ConstraintType | 'overall', runs: Scored[]): CountRow<ConstraintType | 'overall'> {
  const ofKind = ({ type }: { type: ConstraintType }) => kind === 'overall' || type === kind;
  const hits = runs.flatMap(({ pairs }) => pairs).filter(({ expected }) => ofKind(expected)).length;
  const answered = runs.flatMap(({ answered: { constraints } }) => constraints).filter(ofKind).length;
  const expected = runs.flatMap(({ expected: { constraints } }) => constraints).filter(ofKind).length;
  return countRow(kind, hits, answered, expected);
}

function groupRow(kind: 'sameDish' | 'anyOf', runs: Scored[]): CountRow<'sameDish' | 'anyOf'> {
  const hits = sum(runs.map(({ expected, answered, pairs }) => groupHits(expected[kind] ?? [], answered[kind] ?? [], pairs)));
  const answered = sum(runs.map((run) => (run.answered[kind] ?? []).length));
  const expected = sum(runs.map((run) => (run.expected[kind] ?? []).length));
  return countRow(kind, hits, answered, expected);
}

function countRow<K>(kind: K, hits: number, answered: number, expected: number): CountRow<K> {
  return { kind, hits, answered, expected, precision: ratio(hits, answered), recall: ratio(hits, expected) };
}

function share(pairs: ConstraintPair[], matches: (pair: ConstraintPair) => boolean) {
  const matching = pairs.filter(matches).length;
  return { matching, of: pairs.length, share: ratio(matching, pairs.length) };
}

function rejectionRow(category: RejectionCategory, runs: Scored[]) {
  const labelled = runs.filter(({ request: { expected } }) => expected.kind === 'rejection' && expected.category === category);
  const hits = labelled.filter(({ outcome }) => outcome.kind === 'rejection' && outcome.category === category).length;
  return { category, hits, total: labelled.length };
}

function idsWhere(runs: Scored[], predicate: (run: Scored) => boolean): string[] {
  return runs.filter(predicate).map(({ request }) => request.id);
}

function latency(times: number[]): ModelReport['latency'] {
  if (times.length === 0) return { meanMs: null, maxMs: null };
  return { meanMs: sum(times) / times.length, maxMs: Math.max(...times) };
}

// Only a request with a miss: a constraint not found, a constraint that misses, or a wrong rejection.
function detailOf(model: string, run: Scored): RequestDetail[] {
  const notFound = unpaired(run.expected.constraints, run.pairs.map(({ expected }) => expected));
  const missed = unpaired(run.answered.constraints, run.pairs.map(({ answered }) => answered));
  if (notFound.length === 0 && missed.length === 0 && !wrongRejection(run)) return [];
  return [{ id: run.request.id, model, expected: expectedText(run.request), answer: answerText(run.outcome), notFound, missed }];
}

function unpaired(constraints: SearchRequestDto['constraints'], paired: Constraint[]): ConstraintText[] {
  return constraints.filter((candidate) => !paired.includes(candidate)).map(({ term, type, polarity }) => ({ term, type, polarity }));
}

function wrongRejection({ request: { expected }, outcome }: Scored): boolean {
  const rejected = outcome.kind === 'rejection' ? outcome.category : null;
  return (expected.kind === 'rejection' ? expected.category : null) !== rejected;
}

function expectedText({ expected }: DecomposerRequest): string {
  return expected.kind === 'search' ? 'search' : `rejection: ${expected.category}`;
}

function answerText(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'structure':
      return 'structure';
    case 'rejection':
      return `rejection: ${outcome.category}`;
    case 'invalid':
      return 'invalid answer';
    case 'failed':
      return 'failed call';
  }
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
