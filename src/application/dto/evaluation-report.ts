import type { SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import type { QueryType } from '@/application/ports/golden-set-source';

/**
 * What `evaluate-search` measures (spec search-evaluation). It holds ids, types, strategy names and numbers only,
 * because it is committed to a public repository (SEG-datos-nutricionista).
 */
export type EvaluationReport = {
  parameters: RunParameters;
  cells: ReportCell[];
  queries: QueryScore[];
  /** The kept queries whose grades are all 0: they stay out of the means. */
  withoutRelevant: string[];
};

type RunParameters = {
  embeddingModel: string;
  dimensions: number;
  hybridWeight: number;
  matchThreshold: Record<SearchStrategy, number>;
  minMenuScore: number;
};

/** The means of one query type, or of all of them, for one strategy, with the number of queries behind each. */
type ReportCell = {
  type: QueryType | 'overall';
  strategy: SearchStrategy;
  ndcg: number | null;
  ndcgQueries: number;
  hit: number | null;
  hitQueries: number;
};

/** One query with one strategy. Null when the query has no relevant menu, or no grade-2 menu for hit@5. */
type QueryScore = {
  id: string;
  type: QueryType;
  strategy: SearchStrategy;
  ndcg: number | null;
  hit: number | null;
  empty: boolean;
};

/** The search result of one query with one strategy, for the console only: it names dishes, so it is never saved. */
export type QueryDetail = { id: string; result: SearchResultDto };

export type Evaluation = { report: EvaluationReport; details: QueryDetail[] };

export type EvaluateSearchError =
  | { kind: 'golden-set-invalid'; file: string; reason: string }
  | { kind: 'invalid-input'; id: string; problem: string }
  | { kind: 'index-not-loaded'; message: string }
  | { kind: 'search-failed'; id?: string; reason: string };
