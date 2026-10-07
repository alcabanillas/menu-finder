## 1. Database Migration & Port Definition

- [x] 1.1 Create migration `postgres/migrations/007-rate-limit.sql` with `rate_limit_bucket` table (`key`, `count`, `expires_at`, `updated_at`), index on `expires_at`, and row-level security enabled without public policies.
- [x] 1.2 Define `RateLimiter` port and status types in `src/application/ports/rate-limiter.ts`.

## 2. PostgreSQL Rate Limiter Adapter (TDD)

- [x] 2.1 [RED] Write failing integration tests in `src/infrastructure/postgres/postgres-rate-limiter.test.ts` testing atomic increments, expiry rollover, limit checks, D-1 opportunistic purge, and resets against the test database.
- [x] 2.2 [GREEN] Implement `PostgresRateLimiter` in `src/infrastructure/postgres/postgres-rate-limiter.ts` until all integration tests pass.

## 3. Sign-in Use Case Rate Limiting (TDD)

- [x] 3.1 [RED] Write failing unit tests in `src/application/use-cases/sign-in.test.ts` covering:
  - Account blocked from IP after 5 failed attempts within 15 minutes.
  - Verification that independent accounts on the same IP are not blocked.
  - Verification that credentials are not evaluated when IP and email are blocked.
  - Increment of failure count on wrong credentials or invalid input.
  - Reset of failed attempts on successful sign-in.
  - Audit logging of refused sign-in with reason `rate-limited`.
- [x] 3.2 [GREEN] Update `signIn` use case in `src/application/use-cases/sign-in.ts` and `src/application/ports/audit-log.ts` to accept `RateLimiter` dependency and client IP, building composite key and passing all unit tests.

## 4. Web Container & UI Integration (TDD)

- [x] 4.1 [RED] Write failing tests for client IP extraction in `src/composition/web-container.test.ts` and rate-limit error rendering in `src/app/_session/actions.test.ts`.
- [x] 4.2 [GREEN] Wire `PostgresRateLimiter` and IP extraction into `src/composition/web-container.ts`, update server action in `src/app/_session/actions.ts` and sign-in view in `src/app/_session/sign-in-screen.tsx` to announce `"Demasiados intentos. Espera unos minutos."`.

## 5. Verification & Safety Review

- [x] 5.1 Run `pnpm test:run`, `pnpm lint`, `pnpm build`, and execute `openspec validate` to verify complete coherence.
