import type { RejectionCategory } from '@/application/dto/decomposition';

type ConstraintType = 'literal' | 'exclusion' | 'attribute' | 'fuzzy';

/**
 * What `evaluate-decomposer` measures for each model (spec decomposer-evaluation). It holds model names, request ids
 * and numbers only, because it is committed (MF-40.3 design D5).
 */
export type DecomposerReport = { requests: number; models: ModelReport[] };

export type ModelReport = {
  model: string;
  /** One row per constraint type, then `overall`. */
  constraints: CountRow<ConstraintType | 'overall'>[];
  /** Over the constraint hits: how many also have the same `hard`, and the same `slot`. */
  hard: Share;
  slot: Share;
  groups: CountRow<'sameDish' | 'anyOf'>[];
  rejections: RejectionRow[];
  /** The search requests the model rejected, which is a mistake. */
  rejectedSearches: string[];
  /** Answers the decomposer refused, and calls that failed: both scored as no constraints. */
  invalidAnswers: string[];
  failedCalls: string[];
  latency: { meanMs: number | null; maxMs: number | null };
};

/** Hits over answered is the precision, hits over expected the recall; null when the count behind it is 0. */
export type CountRow<K> = {
  kind: K;
  hits: number;
  answered: number;
  expected: number;
  precision: number | null;
  recall: number | null;
};

type Share = { matching: number; of: number; share: number | null };

type RejectionRow = { category: RejectionCategory; hits: number; total: number };

/** A constraint as the console names it. */
export type ConstraintText = { term: string; type: ConstraintType; polarity: 'include' | 'exclude' };

/**
 * One request of one model with a miss, for the console only: it names terms, so it is never written. `answer` says
 * what came back: `structure`, `rejection: <category>`, `invalid answer` or `failed call`.
 */
export type RequestDetail = {
  id: string;
  model: string;
  expected: string;
  answer: string;
  notFound: ConstraintText[];
  missed: ConstraintText[];
};

export type DecomposerEvaluation = { report: DecomposerReport; details: RequestDetail[] };

export type EvaluateDecomposerError = { kind: 'golden-set-invalid'; file: string; reason: string };
