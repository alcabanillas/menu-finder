import { CONSTRAINT_TYPES, type ConstraintType } from '@/domain/search/search-request';

/** The query types of the retrieval golden set (EVAL-golden-sets): one per constraint type, and queries that combine them. */
export const QUERY_TYPES = [...CONSTRAINT_TYPES, 'combined'] as const;
export type QueryType = ConstraintType | 'combined';
