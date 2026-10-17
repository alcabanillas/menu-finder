# Design: Client IP resolution via port for sign-in rate limiting (MF-63)

## Context

See proposal.md - Why. Current state:
- `authUseCases` in `src/composition/web/auth-use-cases.ts` accepts `requestHeaders: RequestHeaders` and calls `await forwardedClientIp(requestHeaders)`, passing the string as `clientIp` in `SignInInput`.
- This violates ADR-001 §3 ("composition solo cablea"): the composition root performs per-request extraction logic.
- `SignInInput` in `src/application/use-cases/auth/sign-in.ts` exposes `clientIp?: string`, allowing external callers to potentially pass or override the client IP.

## Goals / Non-Goals

**Goals:**
- Keep composition roots purely declarative ("composition only wires").
- Eliminate `clientIp` from `SignInInput`.
- Decouple `signIn` use case from HTTP transport details while retaining accurate rate-limiting by client IP.
- Satisfy the mandatory port reuse rule by explaining why no existing port covers this boundary.

**Non-Goals:**
- Changing the rate limiting algorithm, thresholds (5 attempts in 15 min), or storage format in PostgreSQL.
- Changing header precedence (`x-forwarded-for` first address, then `x-real-ip`, then loopback `127.0.0.1`).

## Decisions

### D1. A new port `ClientIpSource` for client network address resolution

A new port `ClientIpSource` is defined in `src/application/ports/client-ip-source.ts`:
```typescript
export interface ClientIpSource {
  clientIp(): Promise<string>;
}
```

**Why no existing port fits (Port Reuse Rule):**
Every existing port in `src/application/ports/` was reviewed:
- `SessionManager`: manages credentials authentication and session lifecycles via Better Auth cookies. It does not provide network IP detection.
- `RateLimiter`: increments, checks, and resets numeric counters for arbitrary keys in PostgreSQL; it has no knowledge of HTTP request headers.
- `Clock`: returns calendar and time representations.
- `AuditLog`: writes structured audit events to stdout.
- Data repositories (`MenuRepository`, `RecipeRepository`, `SelectionRepository`, etc.): handle persistence of domain aggregates.

Obtaining the client's network IP from HTTP transport headers (`x-forwarded-for`, `x-real-ip`) is a distinct external boundary with the web server environment. No existing port covers it.

- **Alternative rejected:** Adding `clientIp()` to `SessionManager`. Rejected because session management is about cookies and user identities; coupling IP extraction to `SessionManager` would violate single responsibility and pollute session contracts.
- **Alternative rejected:** Adding `clientIp()` to `RateLimiter`. Rejected because `RateLimiter` is an infrastructure database store for buckets; it is not an HTTP request reader.

### D2. Thin adapter `ForwardedClientIpSource` in `src/infrastructure/http/`

`src/infrastructure/http/forwarded-client-ip-source.ts` implements `ClientIpSource`:
```typescript
export class ForwardedClientIpSource implements ClientIpSource {
  constructor(private readonly requestHeaders: RequestHeaders) {}

  async clientIp(): Promise<string> {
    return forwardedClientIp(this.requestHeaders);
  }
}
```
It delegates to the existing, well-tested `forwardedClientIp` utility.

### D3. `SignInInput` contains only credentials

`SignInInput` is simplified to:
```typescript
export type SignInInput = { email?: unknown; password?: unknown };
```
The caller cannot supply or tamper with the client IP.

### D4. `signIn` use case requires `clientIp: ClientIpSource` in `Deps`

`signIn(deps: Deps, input: SignInInput)` resolves the client IP asynchronously from `deps.clientIp`:
```typescript
type Deps = {
  sessions: SessionManager;
  auditLog: AuditLog;
  rateLimiter: RateLimiter;
  clientIp: ClientIpSource;
};
```
When checking the rate limit key:
```typescript
const clientIp = await deps.clientIp.clientIp();
const key = rateLimitKey(clientIp, input.email);
```

### D5. `src/composition/web/` wiring

In `src/composition/web/infrastructure-deps.ts`:
`buildDeps` constructs `clientIp: new ForwardedClientIpSource(requestHeaders)`.

In `src/composition/web/auth-use-cases.ts`:
`authUseCases(lazyDeps: () => Deps)` simply wires:
```typescript
export function authUseCases(lazyDeps: () => Deps) {
  return {
    signIn: async (input: SignInInput) => signIn(lazyDeps(), input),
    signOut: async () => signOut(lazyDeps()),
    currentUser: async () => currentUser(lazyDeps()),
  };
}
```
`authUseCases` no longer receives `requestHeaders`, no longer calls `forwardedClientIp`, and no longer imports from `src/infrastructure/http/`.

## Risks / Trade-offs

- [Risk: Asynchronous IP resolution overhead] → `forwardedClientIp` merely inspects already-resolved Next.js request headers in memory; overhead is negligible (< 1ms).
- [Risk: Breaking existing tests that pass `clientIp` in `SignInInput`] → All tests in `sign-in.test.ts` and `web-container.test.ts` will provide a mock/fake `ClientIpSource` object, ensuring explicit and verifiable test contracts.
