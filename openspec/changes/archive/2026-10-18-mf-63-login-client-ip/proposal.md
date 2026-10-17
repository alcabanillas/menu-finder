# Proposal: Client IP resolution via port for sign-in rate limiting (MF-63)

## Why

Currently, `createWebContainer` in `src/composition/web-container.ts` (and `src/composition/web/auth-use-cases.ts`) calls `forwardedClientIp` to resolve the client IP and passes it as `clientIp` inside `SignInInput`. This violates the principle that the composition root only wires dependencies and should not contain per-request parsing or input extraction logic (`ADR-001 §3`, `openspec/changes/archive/2026-10-14-mf-22-3-web-search-entry/design.md`). Furthermore, accepting `clientIp` in `SignInInput` mixes caller-supplied credentials with infrastructure network metadata, creating a risk that callers or forms could manipulate the rate limit key.

Resolving the client IP through an injected port (`ClientIpSource`), built once with `requestHeaders` in `src/composition/web/infrastructure-deps.ts` just like `BetterAuthSessionManager`, restores the purity of the composition root and makes sign-in input strictly contain user credentials.

## What Changes

- Introduce the port `ClientIpSource` in `src/application/ports/client-ip-source.ts` with method `clientIp(): Promise<string>`.
- Implement `ForwardedClientIpSource` in `src/infrastructure/http/forwarded-client-ip-source.ts` (or adapt `forwardedClientIp`).
- Update `SignInInput` in `src/application/use-cases/auth/sign-in.ts` to remove `clientIp`.
- Add `clientIp: ClientIpSource` to `signIn` dependencies (`Deps`).
- Update `buildDeps` in `src/composition/web/infrastructure-deps.ts` to instantiate `ForwardedClientIpSource(requestHeaders)`.
- Simplify `authUseCases` in `src/composition/web/auth-use-cases.ts`: it no longer takes `requestHeaders` or calls `forwardedClientIp`.
- Remove `requestHeaders` from `createWebContainer`'s `authUseCases` call; `src/composition/web/` no longer imports from `src/infrastructure/http/`.
- Update tests to provide a mock/stub `ClientIpSource`.

## Capabilities

### Modified Capabilities

- `rate-limiting`: clarify that client IP for sign-in throttling is resolved from the request context via an injected port and is never accepted in user-supplied sign-in input.

## Impact

- **Affected code:** `src/application/ports/client-ip-source.ts` (new), `src/infrastructure/http/forwarded-client-ip-source.ts` (new), `src/application/use-cases/auth/sign-in.ts`, `src/composition/web/infrastructure-deps.ts`, `src/composition/web/auth-use-cases.ts`, `src/composition/web-container.ts`.
- **Security & OWASP:** A07:2021 Identification and Authentication Failures, A04:2021 Insecure Design. Enforces that client IP cannot be spoofed via `SignInInput` parameters.
- **Breaking changes:** `SignInInput` no longer accepts `clientIp`. `signIn` dependencies now require `clientIp: ClientIpSource`.
