import type { SearchFailureEvent } from '@/application/dto/search-failure-event';

/**
 * Where the web search sends the failures of the system (spec error-reporting). Monitoring is an external boundary:
 * the event leaves the application already redacted.
 */
export interface SearchFailureReport {
  report(event: SearchFailureEvent): void;
}
