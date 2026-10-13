import pg from 'pg';
import type { RateLimiter } from '@/application/ports/rate-limiter';
import { BetterAuthSessionManager } from '@/infrastructure/auth/better-auth-session-manager';
import { createAuth } from '@/infrastructure/auth/create-auth';
import { SystemClock } from '@/infrastructure/clock/system-clock';
import { StdoutAuditLog } from '@/infrastructure/logging/stdout-audit-log';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRateLimiter } from '@/infrastructure/postgres/postgres-rate-limiter';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import { PostgresSelectionRepository } from '@/infrastructure/postgres/postgres-selection-repository';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';
import { requireAll, type Env } from './env';
import type { RequestHeaders } from './request-headers';

export type Deps = ReturnType<typeof buildDeps>;

// Small on purpose: each serverless instance opens its own pool, and Neon's pooler does the sharing.
const POOL_SIZE = 3;

/** The adapters every use case of the web shares: one pool, the session, the audit log, the repositories. */
export function buildDeps(env: Env, requestHeaders: RequestHeaders, rateLimiter?: RateLimiter) {
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
