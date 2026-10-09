import { headers } from 'next/headers';
import pg from 'pg';
import type { ActiveMenuInput } from '@/application/use-cases/active-menu';
import type { CheckShoppingItemsInput } from '@/application/use-cases/check-shopping-items';
import type { CurrentSelectionsInput } from '@/application/use-cases/current-selections';
import type { SelectMenuInput } from '@/application/use-cases/select-menu';
import type { SelectRandomMenuInput } from '@/application/use-cases/select-random-menu';
import type { ShoppingChecklistInput } from '@/application/use-cases/shopping-checklist';
import type { SignInInput } from '@/application/use-cases/sign-in';
import type { MenuWeekPageInput } from '@/application/use-cases/menu-week-page';
import { activeMenu } from '@/application/use-cases/active-menu';
import { checkShoppingItems } from '@/application/use-cases/check-shopping-items';
import { currentSelections } from '@/application/use-cases/current-selections';
import { currentUser } from '@/application/use-cases/current-user';
import { selectMenu } from '@/application/use-cases/select-menu';
import { menuWeekPage } from '@/application/use-cases/menu-week-page';
import { selectRandomMenu } from '@/application/use-cases/select-random-menu';
import { shoppingChecklist } from '@/application/use-cases/shopping-checklist';
import { signIn } from '@/application/use-cases/sign-in';
import { signOut } from '@/application/use-cases/sign-out';
import { BetterAuthSessionManager } from '@/infrastructure/auth/better-auth-session-manager';
import { createAuth } from '@/infrastructure/auth/create-auth';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { StdoutAuditLog } from '@/infrastructure/logging/stdout-audit-log';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRateLimiter } from '@/infrastructure/postgres/postgres-rate-limiter';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import { PostgresSelectionRepository } from '@/infrastructure/postgres/postgres-selection-repository';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';

type Env = Record<string, string | undefined>;
type RequestHeaders = () => Promise<Headers>;
type WebContainer = ReturnType<typeof createWebContainer>;

// The pooled URL: on Vercel there is no long-lived process (ADR-001 §5).
const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL'] as const;
// Small on purpose: each serverless instance opens its own pool, and Neon's pooler does the sharing.
const POOL_SIZE = 3;

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
export function createWebContainer(env: Env, requestHeaders: RequestHeaders) {
  let deps: ReturnType<typeof buildDeps> | undefined;
  const lazyDeps = () => {
    deps ??= buildDeps(env, requestHeaders);
    return deps;
  };

  // async, so that a missing variable is a rejected promise like any other failure of the call.
  return {
    signIn: async (input: SignInInput) => {
      const headers = await requestHeaders();
      const clientIp = extractClientIp(headers);
      return signIn(lazyDeps(), { ...input, clientIp });
    },
    signOut: async () => signOut(lazyDeps()),
    currentUser: async () => currentUser(lazyDeps()),
    selectMenu: async (input: SelectMenuInput) => selectMenu(lazyDeps(), input),
    currentSelections: async (input: CurrentSelectionsInput) => currentSelections(lazyDeps(), input),
    selectRandomMenu: async (input: SelectRandomMenuInput) => selectRandomMenu(lazyDeps(), input),
    activeMenu: async (input: ActiveMenuInput) => activeMenu(lazyDeps(), input),
    menuWeekPage: async (input: MenuWeekPageInput) => menuWeekPage(lazyDeps(), input),
    shoppingChecklist: async (input: ShoppingChecklistInput) => shoppingChecklist(lazyDeps(), input),
    checkShoppingItems: async (input: CheckShoppingItemsInput) => checkShoppingItems(lazyDeps(), input),
  };
}

function extractClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first;
  }
  return headers.get('x-real-ip') ?? '127.0.0.1';
}

function buildDeps(env: Env, requestHeaders: RequestHeaders) {
  const [url, secret, baseUrl] = requireAll(env);
  const pool = new pg.Pool({ connectionString: url, max: POOL_SIZE });
  return {
    sessions: new BetterAuthSessionManager(createAuth({ pool, secret, baseUrl }), requestHeaders),
    auditLog: new StdoutAuditLog(),
    rateLimiter: new PostgresRateLimiter(pool),
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
