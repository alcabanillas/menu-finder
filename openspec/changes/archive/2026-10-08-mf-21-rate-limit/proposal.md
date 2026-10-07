# Proposal: MF-21 Rate Limiting

Implements item **MF-21** from `context/roadmap.md`.

## Why

The application currently has no server-side rate limiting on sign-in or outbound LLM calls.
Because the web interface avoids mounting Better Auth's standard HTTP route handlers (MF-20.3) to minimize attack surface, Better Auth's built-in HTTP rate limiting is inactive.
Without failed sign-in throttling, an attacker can attempt brute-force credential stuffing against existing accounts. Furthermore, without a global daily cap on LLM calls, automated bots or abuse of the demo account could exhaust Gemini API quotas and incur financial cost.
Because serverless functions in Vercel do not maintain persistent in-memory state across requests, counters must be stored in Neon behind a domain port (`RateLimiter`).

## What Changes

- Introduce a database-backed rate limiting mechanism in PostgreSQL (`rate_limit_bucket` table with `expires_at` index and RLS) via migration `007-rate-limit.sql`.
- Add the `RateLimiter` port in `src/application/ports/rate-limiter.ts` following `ARQ-hexagonal` and ADR-001.
- Provide a PostgreSQL adapter `PostgresRateLimiter` in `src/infrastructure/postgres/postgres-rate-limiter.ts` with atomic bucket operations and opportunistic cleanup of stale records (`D-1`, older than 24 hours).
- Wire rate limiting into the `signIn` use case (`src/application/use-cases/sign-in.ts`):
  - Check whether the combination of client IP and normalized email has exceeded the threshold of failed attempts (5 failed attempts within 15 minutes).
  - Record a failed attempt upon wrong credentials or invalid input.
  - Automatically purge expired records older than 1 day during failure recording.
  - Clear failed attempts for that IP and account on successful sign-in.
  - Return a distinct rate-limited failure (`{ kind: 'rate-limited', retryAfterSeconds }`) when the threshold is reached.
- Propagate client IP detection in `src/composition/web-container.ts` and handle rate limit messaging on `/login` and `/`.
- Introduce support for the global daily LLM request quota (defaulting to 100 requests per day) within `RateLimiter` to be consumed by LLM use cases.
- Add automated abuse and integration tests in CI verifying that repeated failures trigger blocking, that independent accounts on the same IP are isolated, and that valid logins reset/bypass limits.

## Security & Threat Modeling (safety-first P1, SEG-owasp)

- **Data touched**: Client IP addresses and normalized emails (as composite rate limit keys) and request timestamps/counters. No passwords, tokens, cookies, or sensitive credentials are stored in rate limiting buckets.
- **Potential abuse**:
  - Brute-force dictionary attacks against account credentials.
  - Shared NAT denial of service (mitigated by composite key `ip + email`).
  - Table bloat from distributed bot attacks (mitigated by indexed purge of D-1 records).
  - Distributed denial of service or quota exhaustion of Gemini credits via demo account abuse or repeated queries.
- **OWASP categories**:
  - **A07:2021 – Identification and Authentication Failures**: Mitigated by throttling failed sign-in attempts by composite key (IP + email).
  - **OWASP LLM04:2025 / API4:2023 – Unrestricted Resource Consumption**: Mitigated by enforcing a global daily cap on LLM requests in the database.
  - **A04:2021 – Insecure Design**: Mitigated by architectural separation of limits in a database port instead of ephemeral instance memory.
- **Decisions cited**:
  - `SEG-rate-limit`: Two-level server rate limits (failed logins by IP and global daily LLM quota) in Neon behind `RateLimiter`.
  - `SEG-auth`: Better Auth without HTTP endpoints; login as server action.
  - `SEG-sistema-cerrado`: Closed system with two accounts; demo account protected from credit drain.
  - `ARQ-hexagonal`: `RateLimiter` port in application layer; `PostgresRateLimiter` adapter in infrastructure.
  - `ARQ-nextjs`: Next.js Server Actions with IP extracted from headers.
  - `OPS-calidad`: Automated abuse tests running in CI against Neon test branch.

## Capabilities

### New Capabilities
- `rate-limiting`: Server-side rate limiter port and PostgreSQL adapter supporting atomic bucket counters for composite IP + email failed sign-ins and global daily LLM usage, with indexed cleanup of stale records.

### Modified Capabilities
- `authentication`: Sign-in rejects requests from a client IP and account combination that exceeds the allowed number of failed attempts within the active time window, without calling session verification.

## Impact

- **Database**: Migration `007-rate-limit.sql` creates table `rate_limit_bucket` with index on `expires_at` and RLS enabled.
- **Core (Application/Domain)**: `src/application/ports/rate-limiter.ts`, updated `src/application/use-cases/sign-in.ts`.
- **Infrastructure**: `src/infrastructure/postgres/postgres-rate-limiter.ts`.
- **Web UI**: `/login` and `/` display rate limit feedback when a client IP and account are blocked.
- **Tests**: Integration tests against Neon test database and unit tests for use cases and rate limiting logic.
