import { searchByTextWithinDailyLimit, type DailyLimitedSearchDeps } from '@/application/use-cases/search/search-by-text';

// The default of the CLI (MF-22.1): the embedding of the terms, with no text match.
const WEB_SEARCH_STRATEGY = 'semantic';

/** The use cases of the search. Its dependencies are built on the first search, not on the first call of the web. */
export function searchUseCases(lazySearch: () => DailyLimitedSearchDeps) {
  return {
    // No session check here: the server action of MF-22.4 calls this only for a signed-in user, with its id.
    searchByText: async (userId: string, request: string) =>
      searchByTextWithinDailyLimit(userId, request, WEB_SEARCH_STRATEGY, lazySearch()),
  };
}
