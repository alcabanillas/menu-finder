import type pg from 'pg';
import type { RateLimiter, RateLimitOptions, RateLimitStatus } from '@/application/ports/rate-limiter';

type BucketRow = { count: number; expires_at: Date };

/**
 * PostgreSQL adapter for RateLimiter using atomic single-query upserts on Neon (SEG-rate-limit).
 */
export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly pool: pg.Pool) {}

  /** Checks whether the given key is currently blocked without recording an attempt. */
  async check(key: string, limit: number): Promise<RateLimitStatus> {
    const { rows } = await this.pool.query<BucketRow>(
      `SELECT count, expires_at
       FROM rate_limit_bucket
       WHERE key = $1 AND expires_at >= NOW()`,
      [key],
    );

    if (rows.length === 0) {
      return { allowed: true, remaining: limit, resetAt: new Date() };
    }

    const { count, expires_at: resetAt } = rows[0];
    const allowed = count < limit;
    const remaining = Math.max(0, limit - count);
    return { allowed, remaining, resetAt: new Date(resetAt) };
  }

  /** Atomically records one hit, creates or updates the bucket, and opportunistically purges stale records. */
  async hit(key: string, { limit, windowSeconds }: RateLimitOptions): Promise<RateLimitStatus> {
    await this.purgeStaleRecords();

    const { rows } = await this.pool.query<BucketRow>(
      `INSERT INTO rate_limit_bucket (key, count, expires_at, updated_at)
       VALUES ($1, 1, NOW() + ($2 || ' seconds')::interval, NOW())
       ON CONFLICT (key) DO UPDATE
       SET count = CASE
             WHEN rate_limit_bucket.expires_at < NOW() THEN 1
             ELSE rate_limit_bucket.count + 1
           END,
           expires_at = CASE
             WHEN rate_limit_bucket.expires_at < NOW() THEN NOW() + ($2 || ' seconds')::interval
             ELSE rate_limit_bucket.expires_at
           END,
           updated_at = NOW()
       RETURNING count, expires_at`,
      [key, windowSeconds],
    );

    const { count, expires_at: resetAt } = rows[0];
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);
    return { allowed, remaining, resetAt: new Date(resetAt) };
  }

  /** Resets or clears the bucket for a key (e.g. after a successful sign-in). */
  async reset(key: string): Promise<void> {
    await this.pool.query('DELETE FROM rate_limit_bucket WHERE key = $1', [key]);
  }

  private async purgeStaleRecords(): Promise<void> {
    await this.pool.query("DELETE FROM rate_limit_bucket WHERE expires_at < NOW() - INTERVAL '1 day'");
  }
}
