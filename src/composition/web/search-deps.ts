import type pg from 'pg';
import { positiveIntegerInput } from '@/application/dto/positive-integer-input';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import type { SearchFailureReport } from '@/application/ports/search-failure-report';
import type { DailyLimitedSearchDeps, SearchByTextDeps } from '@/application/use-cases/search/search-by-text';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { createGenkitRequestDecomposer, DECOMPOSER_MODEL } from '@/infrastructure/genkit/genkit-request-decomposer';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';
import { sentrySearchFailureReport } from '@/infrastructure/sentry/sentry-search-failure-report';
import { requireApiKey, type Env } from './env';
import type { Deps } from './infrastructure-deps';

/** What a test replaces: the adapters the search builds on its first call, the limiter, the clock and the report. */
export type WebSeams = {
  rateLimiter?: RateLimiter;
  now?: () => Date;
  failureReport?: SearchFailureReport;
  searchAdapters?: (apiKey: string, pool: pg.Pool) => SearchByTextDeps;
};

// Searches a day when `LLM_DAILY_LIMIT` is not a positive integer (spec rate-limiting).
const DEFAULT_LLM_DAILY_LIMIT = 100;

/** Built on the first search: a missing GEMINI_API_KEY fails the search only (MF-22.3 design D6). */
export function buildSearchDeps(env: Env, { pool, rateLimiter }: Deps, seams: WebSeams): DailyLimitedSearchDeps {
  const apiKey = requireApiKey(env);
  return {
    ...(seams.searchAdapters ?? genkitSearchAdapters)(apiKey, pool),
    rateLimiter,
    failureReport: seams.failureReport ?? sentrySearchFailureReport,
    now: seams.now ?? (() => new Date()),
    dailyLimit: positiveIntegerInput.safeParse(env.LLM_DAILY_LIMIT).data ?? DEFAULT_LLM_DAILY_LIMIT,
    decomposerModel: DECOMPOSER_MODEL,
    secrets: [apiKey],
  };
}

function genkitSearchAdapters(apiKey: string, pool: pg.Pool): SearchByTextDeps {
  return {
    decomposer: createGenkitRequestDecomposer(apiKey),
    menus: new PostgresMenuRepository(pool),
    dishText: new PostgresDishTextSearch(pool),
    recipeEmbeddings: new PostgresRecipeEmbeddingRepository(pool),
    embeddings: createGenkitEmbeddings(apiKey),
  };
}
