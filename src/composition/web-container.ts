import type { DailyLimitedSearchDeps } from '@/application/use-cases/search/search-by-text';
import { authUseCases } from '@/composition/web/auth-use-cases';
import type { Env } from '@/composition/web/env';
import { buildDeps, type Deps } from '@/composition/web/infrastructure-deps';
import { menuUseCases } from '@/composition/web/menu-use-cases';
import { nextRequestHeaders, type RequestHeaders } from '@/composition/web/request-headers';
import { buildSearchDeps, type WebSeams } from '@/composition/web/search-deps';
import { searchUseCases } from '@/composition/web/search-use-cases';
import { shoppingUseCases } from '@/composition/web/shopping-use-cases';

type WebContainer = ReturnType<typeof createWebContainer>;

const globalCache = globalThis as typeof globalThis & { menuFinderWebContainer?: WebContainer };

/** The container of the web, built once and kept on `globalThis` so that hot reload does not multiply pools. */
export function webContainer(): WebContainer {
  globalCache.menuFinderWebContainer ??= createWebContainer(process.env, nextRequestHeaders);
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

  return {
    ...authUseCases(lazyDeps),
    ...menuUseCases(lazyDeps),
    ...shoppingUseCases(lazyDeps),
    ...searchUseCases(lazySearch),
  };
}
