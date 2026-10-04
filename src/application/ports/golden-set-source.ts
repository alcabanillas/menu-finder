import type { SearchRequestDto } from '@/application/dto/search-request';
import type { Result } from '@/shared/result';

/** The query types of the retrieval golden set (EVAL-golden-sets). */
export type QueryType = 'literal' | 'exclusion' | 'attribute' | 'fuzzy' | 'combined';

/** A query of the retrieval golden set (MF-12): the grade (0, 1 or 2) of each menu, keyed by menu number. */
export type GradedQuery = {
  id: string;
  type: QueryType;
  status: 'kept' | 'withdrawn';
  grades: ReadonlyMap<number, number>;
};

/** A request of the decomposer golden set (MF-13): its expected structure, not yet validated as a search. */
export type ExpectedStructure = { id: string; structure: SearchRequestDto };

export type GoldenSets = { queries: GradedQuery[]; structures: ExpectedStructure[] };

export type GoldenSetError = { kind: 'golden-set-invalid'; file: string; reason: string };

/**
 * The evaluation inputs, files of the repository that no other port reaches: `DocumentSource` reads the
 * nutritionist's PDFs, and the repositories hold the dataset (design D1).
 */
export interface GoldenSetSource {
  read(): Promise<Result<GoldenSets, GoldenSetError>>;
}
