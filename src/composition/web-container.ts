import { headers } from 'next/headers';
import pg from 'pg';
import type { CheckShoppingItemsInput } from '@/application/use-cases/shopping-list/check-shopping-items';
import type { CurrentSelectionsInput } from '@/application/use-cases/menu/current-selections';
import type { SelectRandomMenuInput } from '@/application/use-cases/menu/select-random-menu';
import type { ShoppingChecklistInput } from '@/application/use-cases/shopping-list/shopping-checklist';
import type { SignInInput } from '@/application/use-cases/auth/sign-in';
import type { MenuWeekPageInput } from '@/application/use-cases/menu/menu-week-page';
import { checkShoppingItems } from '@/application/use-cases/shopping-list/check-shopping-items';
import { currentSelections } from '@/application/use-cases/menu/current-selections';
import { currentUser } from '@/application/use-cases/auth/current-user';
import { menuWeekPage } from '@/application/use-cases/menu/menu-week-page';
import { selectRandomMenu } from '@/application/use-cases/menu/select-random-menu';
import { shoppingChecklist } from '@/application/use-cases/shopping-list/shopping-checklist';
import { signIn } from '@/application/use-cases/auth/sign-in';
import { signOut } from '@/application/use-cases/auth/sign-out';
import { positiveIntegerInput } from '@/application/dto/positive-integer-input';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import type { SearchFailureReport } from '@/application/ports/search-failure-report';
import {
  searchByTextWithinDailyLimit,
  type DailyLimitedSearchDeps,
  type SearchByTextDeps,
} from '@/application/use-cases/search/search-by-text';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { createGenkitRequestDecomposer, DECOMPOSER_MODEL } from '@/infrastructure/genkit/genkit-request-decomposer';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';
import { sentrySearchFailureReport } from '@/infrastructure/sentry/sentry-search-failure-report';
import { BetterAuthSessionManager } from '@/infrastructure/auth/better-auth-session-manager';
import { createAuth } from '@/infrastructure/auth/create-auth';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { forwardedClientIp } from '@/infrastructure/http/forwarded-client-ip';
import { StdoutAuditLog } from '@/infrastructure/logging/stdout-audit-log';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRateLimiter } from '@/infrastructure/postgres/postgres-rate-limiter';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import { PostgresSelectionRepository } from '@/infrastructure/postgres/postgres-selection-repository';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';

type Env = Record<string, string | undefined>;
type RequestHeaders = () => Promise<Headers>;
type WebContainer = ReturnType<typeof createWebContainer>;
type Deps = ReturnType<typeof buildDeps>;

/** What a test replaces: the adapters the search builds on its first call, the limiter, the clock and the report. */
export type WebSeams = {
  rateLimiter?: RateLimiter;
  now?: () => Date;
  failureReport?: SearchFailureReport;
  searchAdapters?: (apiKey: string, pool: pg.Pool) => SearchByTextDeps;
};

// The pooled URL: on Vercel there is no long-lived process (ADR-001 §5).
const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const;
// Needed by the search only: login and the menus work without it (design D6).
const GEMINI_API_KEY = 'GEMINI_API_KEY';
// The default of the CLI (MF-22.1): the embedding of the terms, with no text match.
const WEB_SEARCH_STRATEGY = 'semantic';
// Small on purpose: each serverless instance opens its own pool, and Neon's pooler does the sharing.
const POOL_SIZE = 3;
// Searches a day when `LLM_DAILY_LIMIT` is not a positive integer (spec rate-limiting).
const DEFAULT_LLM_DAILY_LIMIT = 100;

const globalCache = globalThis as typeof globalThis & { menuFinderWebContainer?: WebContainer };

/** The container of the web, built once and kept on `globalThis` so that hot reload does not multiply pools. */
export function webContainer(): WebContainer {
  globalCache.menuFinderWebContainer ??= createWebContainer(process.env, headers);
  return globalCache.menuFinderWebContainer;
}

/**
 * Wires the web's use cases to their adapters. Nothing is read or built until the first call, so a build or an import
 * never needs the database; a missing variable is reported then, by name and never by value.
 */
export function createWebContainer(env: Env, requestHeaders: RequestHeaders, seams: WebSeams = {}) {
  let deps: Deps | undefined;
  const lazyDeps = () => {
    deps ??= buildDeps(env, requestHeaders, seams.rateLimiter);
    return deps;
  };
  let search: DailyLimitedSearchDeps | undefined;
  const lazySearch = () => {
    search ??= buildSearchDeps(env, lazyDeps(), seams);
    return search;
  };

  // async, so that a missing variable is a rejected promise like any other failure of the call.
  return {
    signIn: async (input: SignInInput) =>
      signIn(lazyDeps(), { ...input, clientIp: await forwardedClientIp(requestHeaders) }),
    signOut: async () => signOut(lazyDeps()),
    currentUser: async () => currentUser(lazyDeps()),
    currentSelections: async (input: CurrentSelectionsInput) => currentSelections(lazyDeps(), input),
    selectRandomMenu: async (input: SelectRandomMenuInput) => selectRandomMenu(lazyDeps(), input),
    menuWeekPage: async (input: MenuWeekPageInput) => menuWeekPage(lazyDeps(), input),
    shoppingChecklist: async (input: ShoppingChecklistInput) => shoppingChecklist(lazyDeps(), input),
    checkShoppingItems: async (input: CheckShoppingItemsInput) => checkShoppingItems(lazyDeps(), input),
    // No session check here: the server action of MF-22.4 calls this only for a signed-in user.
    searchByText: async (request: string) =>
      searchByTextWithinDailyLimit(request, WEB_SEARCH_STRATEGY, lazySearch()),
  };
}

// Built on the first search: a missing GEMINI_API_KEY fails the search only (MF-22.3 design D6).
function buildSearchDeps(env: Env, { pool, rateLimiter }: Deps, seams: WebSeams): DailyLimitedSearchDeps {
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

function requireApiKey(env: Env): string {
  const apiKey = env[GEMINI_API_KEY];
  if (!apiKey) throw new Error(`Missing environment variables: ${GEMINI_API_KEY}`);
  return apiKey;
}

function buildDeps(env: Env, requestHeaders: RequestHeaders, rateLimiter?: RateLimiter) {
  const [url, secret, baseUrl] = requireAll(env);
  const pool = new pg.Pool({ connectionString: url, max: POOL_SIZE });
  return {
    pool,
    sessions: new BetterAuthSessionManager(createAuth({ pool, secret, baseUrl }), requestHeaders),
    auditLog: new StdoutAuditLog(),
    rateLimiter: rateLimiter ?? new PostgresRateLimiter(pool),
    selections: new PostgresSelectionRepository(pool),
    clock: new SystemClock(),
    menus: new PostgresMenuRepository(pool),
    recipes: new PostgresRecipeRepository(pool),
    shoppingLists: new PostgresShoppingListRepository(pool),
    random: Math.random,
  };
}

function requireAll(env: Env): string[] {
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  return REQUIRED.map((name) => env[name]!);
}
