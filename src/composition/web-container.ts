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
import { searchByTextWithinDailyLimit, type DailyLimitedSearchDeps } from '@/application/use-cases/search/search-by-text';
import { forwardedClientIp } from '@/infrastructure/http/forwarded-client-ip';
import type { Env } from '@/composition/web/env';
import { buildDeps, type Deps } from '@/composition/web/infrastructure-deps';
import { nextRequestHeaders, type RequestHeaders } from '@/composition/web/request-headers';
import { buildSearchDeps, type WebSeams } from '@/composition/web/search-deps';

type WebContainer = ReturnType<typeof createWebContainer>;

// The default of the CLI (MF-22.1): the embedding of the terms, with no text match.
const WEB_SEARCH_STRATEGY = 'semantic';

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
