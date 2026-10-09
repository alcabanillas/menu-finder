import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PostgresRateLimiter } from '@/infrastructure/postgres/postgres-rate-limiter';
import {
  createMigratedTestDatabase,
  TEST_DATABASE_URL,
  type TestDatabase,
} from '@/infrastructure/postgres/test-database';

const OWN_DATABASE_TIMEOUT_MS = 30_000;
const TEST_KEY = 'login:failed:192.168.1.10:ana@example.test';
const OTHER_KEY = 'login:failed:192.168.1.10:bruno@example.test';
const LIMIT = 5;
const WINDOW_SECONDS = 900; // 15 minutes

describe.skipIf(!TEST_DATABASE_URL)('PostgresRateLimiter (Neon test branch)', () => {
  let db: TestDatabase;
  let limiter: PostgresRateLimiter;

  beforeAll(async () => {
    db = await createMigratedTestDatabase(TEST_DATABASE_URL!);
    limiter = new PostgresRateLimiter(db.pool);
  }, OWN_DATABASE_TIMEOUT_MS);

  beforeEach(async () => {
    await db.truncate();
  });

  afterAll(async () => {
    await db.drop();
  });

  it('allows checking a key that has no previous records', async () => {
    const status = await limiter.check(TEST_KEY, LIMIT);
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(LIMIT);
  });

  it('records hits atomically and reduces remaining count', async () => {
    const first = await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(LIMIT - 1);
    expect(first.resetAt.getTime()).toBeGreaterThan(Date.now());

    for (let i = 2; i <= LIMIT; i += 1) {
      await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    }

    const checkBlocked = await limiter.check(TEST_KEY, LIMIT);
    expect(checkBlocked.allowed).toBe(false);
    expect(checkBlocked.remaining).toBe(0);

    const hitBlocked = await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    expect(hitBlocked.allowed).toBe(false);
    expect(hitBlocked.remaining).toBe(0);
  });

  it('keeps independent composite keys on the same IP isolated', async () => {
    for (let i = 0; i < LIMIT; i += 1) {
      await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    }

    const blockedStatus = await limiter.check(TEST_KEY, LIMIT);
    expect(blockedStatus.allowed).toBe(false);

    const otherStatus = await limiter.check(OTHER_KEY, LIMIT);
    expect(otherStatus.allowed).toBe(true);
    expect(otherStatus.remaining).toBe(LIMIT);
  });

  it('resets a key bucket when reset is called', async () => {
    await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });

    await limiter.reset(TEST_KEY);

    const status = await limiter.check(TEST_KEY, LIMIT);
    expect(status.allowed).toBe(true);
    expect(status.remaining).toBe(LIMIT);
  });

  it('resets count when the window has expired', async () => {
    // Insert an expired bucket in the database
    await db.pool.query(
      `INSERT INTO rate_limit_bucket (key, count, expires_at, updated_at)
       VALUES ($1, $2, NOW() - INTERVAL '10 seconds', NOW() - INTERVAL '10 seconds')`,
      [TEST_KEY, LIMIT],
    );

    const checkStatus = await limiter.check(TEST_KEY, LIMIT);
    expect(checkStatus.allowed).toBe(true);
    expect(checkStatus.remaining).toBe(LIMIT);

    const hitStatus = await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    expect(hitStatus.allowed).toBe(true);
    expect(hitStatus.remaining).toBe(LIMIT - 1);
  });

  it('opportunistically purges stale records older than 1 day during a hit', async () => {
    const staleKey = 'login:failed:10.0.0.1:stale@example.test';
    const recentKey = 'login:failed:10.0.0.2:recent@example.test';

    // Stale: expired 2 days ago
    await db.pool.query(
      `INSERT INTO rate_limit_bucket (key, count, expires_at, updated_at)
       VALUES ($1, 5, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days')`,
      [staleKey],
    );

    // Recent: expired 1 hour ago (within 1 day grace period)
    await db.pool.query(
      `INSERT INTO rate_limit_bucket (key, count, expires_at, updated_at)
       VALUES ($1, 5, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour')`,
      [recentKey],
    );

    await limiter.hit(TEST_KEY, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });

    const { rows: staleRows } = await db.pool.query('SELECT key FROM rate_limit_bucket WHERE key = $1', [staleKey]);
    expect(staleRows).toHaveLength(0);

    const { rows: recentRows } = await db.pool.query('SELECT key FROM rate_limit_bucket WHERE key = $1', [recentKey]);
    expect(recentRows).toHaveLength(1);
  });

  it('safely handles keys with null characters without PostgreSQL encoding errors', async () => {
    const keyWithNull = 'login:failed:192.168.1.10:ana\u0000@example.test';

    const check = await limiter.check(keyWithNull, LIMIT);
    expect(check.allowed).toBe(true);

    const hit = await limiter.hit(keyWithNull, { limit: LIMIT, windowSeconds: WINDOW_SECONDS });
    expect(hit.allowed).toBe(true);
    expect(hit.remaining).toBe(LIMIT - 1);

    await limiter.reset(keyWithNull);
    const afterReset = await limiter.check(keyWithNull, LIMIT);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(LIMIT);
  });
});

