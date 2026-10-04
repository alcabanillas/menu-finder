/**
 * The structure of a search as it comes from outside: what the decomposer emits from a request (BUS-descomponedor),
 * and the expected structure of the decomposer golden set (spec menu-search, "Request structure"). It is not
 * trusted: `searchMenus` validates it and turns it into the domain request.
 */
export type SearchRequestDto = {
  constraints: ConstraintDto[];
  sameDish?: string[][];
  anyOf?: string[][];
};

type ConstraintDto = {
  id: string;
  type: 'literal' | 'exclusion' | 'attribute' | 'fuzzy';
  term: string;
  polarity: 'include' | 'exclude';
  hard: boolean;
  slot?: 'lunch' | 'dinner';
};

export type SearchRequestIssue = {
  /** The id of the constraint the issue is about, when there is one. */
  constraint?: string;
  field: string;
  message: string;
};

/** A structure rejected before any query: every issue names its field and, when there is one, its constraint. */
export type SearchRequestError = { kind: 'invalid-request'; issues: SearchRequestIssue[] };
