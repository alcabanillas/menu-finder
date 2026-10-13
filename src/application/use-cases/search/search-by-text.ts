import type { SearchFailureEvent } from '@/application/dto/search-failure-event';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type {
  DailyLimitedSearchError,
  SearchByTextError,
  SearchStrategy,
  TextSearchDto,
} from '@/application/dto/search-result';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import type { SearchFailureReport } from '@/application/ports/search-failure-report';
import { decomposeText, type DecomposeTextDeps } from '@/application/services/search/decompose-text';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import { redactSecrets } from '@/shared/redact-secrets';
import { err, ok, type Result } from '@/shared/result';

export type SearchByTextDeps = DecomposeTextDeps & FindMenusDeps;

/** What the web adds to the search: the global daily ceiling and the report of the system's failures. */
export type DailyLimitedSearchDeps = SearchByTextDeps & {
  rateLimiter: RateLimiter;
  failureReport: SearchFailureReport;
  now: () => Date;
  dailyLimit: number;
  decomposerModel: string;
  /** Values removed from a reported reason, besides the request. */
  secrets: string[];
};

const DAY_SECONDS = 86_400;
// `2026-10-13T10:00:00.000Z` → `2026-10-13`
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

/**
 * Searches the menus from the text of a request: one call to the model, then the search with its structure,
 * unchanged (spec menu-search, "Search from a request"). The CLI's search: no daily limit, no report.
 */
export async function searchByText(
  request: string,
  strategy: SearchStrategy,
  deps: SearchByTextDeps,
): Promise<Result<TextSearchDto, SearchByTextError>> {
  return runSearch(request, strategy, deps);
}

/**
 * The web's search: one hit on the daily bucket before any call to the model, then the same search, then one report
 * for an outcome that is a failure of the system (SEG-rate-limit, spec error-reporting). The outcome is returned
 * whether it was reported or not.
 */
export async function searchByTextWithinDailyLimit(
  request: string,
  strategy: SearchStrategy,
  deps: DailyLimitedSearchDeps,
): Promise<Result<TextSearchDto, DailyLimitedSearchError>> {
  const outcome = await limitedSearch(request, strategy, deps);
  if (!outcome.ok) reportFailure(outcome.error, request, deps);
  return outcome;
}

// Shared by both entry points, so that neither calls the other (ADR-001 §3).
async function runSearch(
  request: string,
  strategy: SearchStrategy,
  deps: SearchByTextDeps,
): Promise<Result<TextSearchDto, SearchByTextError>> {
  const structure = await decomposeText(request, deps);
  if (!structure.ok) return structure;
  if (hasNothingToSearch(structure.value)) return err({ kind: 'nothing-to-search' });
  const result = await findMenus(structure.value, strategy, deps);
  if (!result.ok) return result;
  return ok({ structure: structure.value, result: result.value });
}

// A valid decomposition the search refuses ("platos para el finde"): stopped here, so that it neither reaches the
// database nor comes back as an invalid structure the user never wrote (MF-22.1 design D2). With no constraints there
// are no groups either: `decomposeText` refuses a group that names an unknown constraint.
function hasNothingToSearch({ constraints }: Required<SearchRequestDto>): boolean {
  return constraints.length === 0;
}

// One search is one hit, recorded before the decomposer (MF-22.3 design D2).
async function limitedSearch(
  request: string,
  strategy: SearchStrategy,
  deps: DailyLimitedSearchDeps,
): Promise<Result<TextSearchDto, DailyLimitedSearchError>> {
  const status = await deps.rateLimiter.hit(dailyKey(deps.now()), { limit: deps.dailyLimit, windowSeconds: DAY_SECONDS });
  if (!status.allowed) return err({ kind: 'llm-limit-reached' });
  return runSearch(request, strategy, deps);
}

// The key carries the UTC date, so the counter rolls over at midnight UTC whatever time the first search ran (D3).
function dailyKey(now: Date): string {
  return `llm:daily:${now.toISOString().slice(0, ISO_DATE_LENGTH)}`;
}

function reportFailure(error: DailyLimitedSearchError, request: string, deps: DailyLimitedSearchDeps): void {
  const event = toEvent(error, deps);
  if (!event) return;
  const secrets = [...deps.secrets, request.trim()];
  deps.failureReport.report(event.reason ? { ...event, reason: redactSecrets(event.reason, secrets) } : event);
}

// The user's outcomes are not failures of the system and give no event; the daily limit is the system working as
// designed, so it is a warning (MF-22.3 design D5).
function toEvent(error: DailyLimitedSearchError, deps: DailyLimitedSearchDeps): SearchFailureEvent | null {
  switch (error.kind) {
    case 'decomposer-failed':
      return { kind: error.kind, level: 'error', model: deps.decomposerModel, reason: error.reason };
    case 'embedding-failed':
      return { kind: error.kind, level: 'error', model: deps.embeddings.model, reason: error.reason };
    case 'search-failed':
      return { kind: error.kind, level: 'error', reason: error.reason };
    case 'index-not-loaded':
      return { kind: error.kind, level: 'error' };
    case 'llm-limit-reached':
      return { kind: error.kind, level: 'warning' };
    default:
      return null;
  }
}
