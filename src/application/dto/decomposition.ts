import type { SearchRequestIssue } from '@/application/dto/search-request';

/** Why a request is not a search for menus (spec decomposer-golden-set, "Rejected requests"). */
export type RejectionCategory = 'gibberish' | 'off-topic' | 'instruction' | 'not-a-search';

/**
 * Why a request gives no structure (spec request-decomposer). A rejection is an error too: the caller must not
 * search with it (MF-40.2 design D7).
 */
export type DecomposeError =
  | { kind: 'request-too-short' }
  | { kind: 'request-too-long'; max: number }
  | { kind: 'rejected'; category: RejectionCategory }
  | { kind: 'invalid-answer'; issues: SearchRequestIssue[] }
  | { kind: 'decomposer-failed'; reason: string };
