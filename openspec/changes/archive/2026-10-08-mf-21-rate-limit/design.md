## Context

See `proposal.md` for background and problem statement.
The system runs serverless Next.js (App Router) on Vercel backed by PostgreSQL on Neon. In-memory counters are ephemeral across serverless invocations, requiring durable coordination in PostgreSQL. Better Auth is driven purely through server actions without exposing HTTP route handlers, bypassing library-level HTTP middleware.

## Goals / Non-Goals

**Goals:**
- Provide a durable `RateLimiter` port in `src/application/ports/rate-limiter.ts`.
- Implement `PostgresRateLimiter` in `src/infrastructure/postgres/postgres-rate-limiter.ts` using a dedicated `rate_limit_bucket` table.
- Add migration `007-rate-limit.sql` with row-level security enabled and an index on `expires_at`.
- Protect `/login` and `/` against brute-force password guessing by blocking a client IP and account combination after 5 failed attempts within 15 minutes.
- Support opportunistic cleanup of stale records older than 1 day (`expires_at < NOW() - INTERVAL '1 day'`) during failure recordings.
- Support atomic token consumption for the global daily LLM request cap (defaulting to 100 calls/day).
- Add automated integration and abuse tests verifying blocking, account isolation under shared NAT, atomic concurrency, window expiry, and reset on successful sign-in.

**Non-Goals:**
- Per-user search rate limiting (the system is closed to 2 accounts; global LLM cap is sufficient per `SEG-rate-limit`).
- External caching infrastructure (Redis/Upstash): Neon is already connected and pool-managed.
- Direct invocation of Gemini inside this PR (Gemini integration belongs to MF-40 / MF-22, which will inject this port).

## Decisions

### D1: Single-query atomic bucket tracking & opportunistic purge in PostgreSQL
**Decision**: Use an `UPSERT` with conditional reset based on timestamp, plus an indexed deletion of records older than 1 day (`D-1`):
```sql
-- 1. Opportunistic purge of records older than 1 day:
DELETE FROM rate_limit_bucket WHERE expires_at < NOW() - INTERVAL '1 day';

-- 2. Atomic bucket upsert:
INSERT INTO rate_limit_bucket (key, count, expires_at, updated_at)
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
RETURNING count, expires_at;
```
**Rationale**: Eliminates race conditions in concurrent serverless invocations with a single roundtrip to Postgres without explicit row locking or transactions. Purging `D-1` records keeps table size bounded while preserving recent data for audit investigation.

### D2: `RateLimiter` Port API
**Decision**: The port exposes:
```ts
export type RateLimitStatus = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

export interface RateLimiter {
  check(key: string, limit: number): Promise<RateLimitStatus>;
  hit(key: string, options: { limit: number; windowSeconds: number }): Promise<RateLimitStatus>;
  reset(key: string): Promise<void>;
}
```
**Rationale**:
- `check`: Fast read to verify whether a key is currently locked before attempting scrypt password hashing or querying user tables.
- `hit`: Atomically records a failure or consumes an invocation allowance, triggering indexed cleanup of stale D-1 rows.
- `reset`: Clears failures on successful authentication (`DELETE FROM rate_limit_bucket WHERE key = $1`).

### D3: Client IP Resolution
**Decision**: Resolve client IP in `src/composition/web-container.ts` using `x-forwarded-for` (first IP before comma) or `x-real-ip`, falling back to `127.0.0.1`.
**Rationale**: Next.js server actions receive headers through `next/headers`. Sanitizing the first IP prevents header injection while accommodating Vercel edge reverse proxies.

### D4: Key Namespacing and Composite Account Keys
**Decision**:
- Sign-in failures: `login:failed:<client_ip>:<normalized_email>` (limit: 5, window: 900s / 15 minutes).
  If no email is provided (empty input), falls back to `login:failed:<client_ip>:anonymous`.
- Global LLM invocations: `llm:global:<YYYY-MM-DD>` (limit: 100, window: 86400s / 24 hours).
**Rationale**:
- Using a composite key (`ip + email`) prevents Denial of Service on shared NAT/proxies (e.g. corporate or university networks where multiple users share an external IP). One user's failed attempts do not block another account from the same IP.
- Normalizing email (lowercase, trimmed) ensures canonical bucket addressing.

### D5: User Experience & Accessible Messaging
**Decision**: When rate-limited, `signIn` returns `{ kind: 'rate-limited' }`. The UI displays: `"Demasiados intentos. Espera unos minutos."` rendered in `<p role="alert">` according to `authentication` spec accessibility requirements.

## Risks / Trade-offs

- **[Risk] High-volume distributed dictionary attacks targeting many emails from one IP**:
  → *Mitigation*: The system is closed with only two authorized accounts (author and tutor demo). An attacker cannot enumerate non-existent accounts to gain access, and attacking known accounts locks that specific account-IP pairing after 5 attempts.
- **[Risk] Database table growth from stale records**:
  → *Mitigation*: Migration `007-rate-limit.sql` indexes `expires_at`. Every `hit` execution opportunistically deletes records where `expires_at < NOW() - INTERVAL '1 day'`, keeping the table lean without requiring external cron jobs or background lambdas.
