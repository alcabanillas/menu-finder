/** The failures of a web search the system reports to monitoring (spec error-reporting). */
type SearchFailureKind =
  | 'decomposer-failed'
  | 'embedding-failed'
  | 'search-failed'
  | 'index-not-loaded'
  | 'llm-limit-reached';

/**
 * One failure of the system: its kind, the model that failed where there is one, and its reason with the key and the
 * text of the request already removed. It never carries the request, its structure or its terms.
 */
export type SearchFailureEvent = {
  kind: SearchFailureKind;
  level: 'error' | 'warning';
  model?: string;
  reason?: string;
};
