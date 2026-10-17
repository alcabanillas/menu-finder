# Tasks

## 1. Port and adapter for client IP

- [ ] 1.1 Create port `ClientIpSource` in `src/application/ports/client-ip-source.ts`
- [ ] 1.2 RED: In `src/infrastructure/http/forwarded-client-ip-source.test.ts`, write tests verifying `ForwardedClientIpSource` implements `ClientIpSource` and returns the resolved IP from `RequestHeaders`. See it fail
- [ ] 1.3 GREEN: Implement `ForwardedClientIpSource` in `src/infrastructure/http/forwarded-client-ip-source.ts`. Verify 1.2 passes

## 2. Core use case: `signIn` decoupling

- [ ] 2.1 RED: In `src/application/use-cases/auth/sign-in.test.ts`, update tests to provide `clientIp: ClientIpSource` in `Deps`, remove `clientIp` from `SignInInput`, and test that the rate-limit key uses the port's IP. See it fail
- [ ] 2.2 GREEN: In `src/application/use-cases/auth/sign-in.ts`, remove `clientIp` from `SignInInput`, add `clientIp: ClientIpSource` to `Deps`, and resolve the IP via `await deps.clientIp.clientIp()`. Verify 2.1 passes

## 3. Web composition root wiring

- [ ] 3.1 RED: In `src/composition/web-container.test.ts`, update tests to verify `signIn` resolves the IP from the wired headers and that `authUseCases` only wires `(lazyDeps)`. See it fail
- [ ] 3.2 GREEN: In `src/composition/web/infrastructure-deps.ts`, wire `clientIp: new ForwardedClientIpSource(requestHeaders)`. In `src/composition/web/auth-use-cases.ts` and `src/composition/web-container.ts`, remove `requestHeaders` and `forwardedClientIp`. Verify 3.1 passes

## 4. Verification and quality checks

- [ ] 4.1 Run `pnpm typecheck` to verify no type errors across the project
- [ ] 4.2 Run ESLint on touched files (`pnpm exec eslint <files> --rule "import/no-cycle: off"`) to verify layer boundaries
- [ ] 4.3 Run `pnpm test:run` across the test suite
- [ ] 4.4 Update `context/roadmap.md` marking MF-63 as done (✅)
