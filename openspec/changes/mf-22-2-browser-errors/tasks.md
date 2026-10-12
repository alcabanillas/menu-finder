## 1. Shared data rules

- [x] 1.1 RED: in `src/instrumentation.test.ts`, add a test that `register` passes the shared `dataCollection` from `src/app/sentry-data-collection.ts` ("Same data rules on both sides"). See it fail
- [x] 1.2 GREEN: move the constant into `src/app/sentry-data-collection.ts` (design D2), import it in `src/instrumentation.ts`, and verify `src/instrumentation.test.ts` passes with its existing tests unchanged

## 2. Browser Sentry

- [x] 2.1 RED: in `src/instrumentation-client.test.ts`, with `@sentry/nextjs` mocked, write "Browser Sentry started with the DSN", "Errors only in the browser" (no tracing or replay options, no replay integration) and "No request data from the browser" (the shared `dataCollection`). See them fail
- [x] 2.2 GREEN: write `src/instrumentation-client.ts` (design D1), add it to the `web-entry` pattern in `eslint.config.mjs`, and verify 2.1 passes and `pnpm lint` passes

## 3. CSP `connect-src`

- [x] 3.1 RED: in `src/app/content-security-policy.test.ts`, write "Exact ingest host allowed", "The app keeps talking to itself", "No wildcard", "Key and project kept out", "No DSN", "Invalid DSN" (all three values) and "Injected directive in the DSN". See them fail
- [x] 3.2 GREEN: give `contentSecurityPolicy` the DSN as an input and add `connect-src 'self' <origin>` only for a valid `https` DSN (design D4). Verify 3.1 and the existing CSP tests pass

## 4. Source maps

- [x] 4.1 RED: in `next.config.test.ts`, write "DSN available to the browser" (`env` exposes `SENTRY_DSN`, design D3), "Build configuration with a token" (upload, delete after upload), "Build configuration without a token" (source maps disabled) and "Security headers kept" through the wrapped config. See them fail
- [x] 4.2 GREEN: wrap `next.config.ts` with `withSentryConfig` (design D5) and verify 4.1 and the existing config tests pass
- [x] 4.3 RED → GREEN: in `e2e/security-headers.spec.ts`, write "No source map served": no `.map` file under the public build output and no `sourceMappingURL` in its scripts. Run `pnpm test:e2e` and verify it passes on a build without `SENTRY_AUTH_TOKEN`

## 5. Dependency fix

- [x] 5.1 Keep the `handlebars` override in `pnpm-workspace.yaml` (design D7). Verify `pnpm why handlebars` shows only 4.7.10 and `pnpm lint`, `pnpm typecheck` and the Genkit adapter tests pass

## 6. Verification

- [ ] 6.1 Run `pnpm lint`, `pnpm typecheck`, `pnpm test:coverage` and `pnpm test:e2e`, and verify they pass with the CI thresholds
- [x] 6.2 Author, before the merge: in Sentry, Allowed Domains (General Settings → Client Security) for the Vercel domain and Spike Protection on, since the free plan has no rate limit per DSN key; in Vercel, check that `SENTRY_AUTH_TOKEN` can upload source maps and add `SENTRY_PROJECT`, plus `SENTRY_ORG` if the token needs it (design D6)
- [ ] 6.3 Author, after the release: on a production page opened with a made-up query parameter, run `setTimeout(() => { throw new Error('MF-22.2 browser check'); })` in the console, and verify the event appears in Sentry with no cookies, headers or query parameters. In Sentry, Settings → Source Maps, verify the deploy uploaded the source maps. The stack trace that names a file in `src/` is checked in MF-22.4, with a temporary button (design Migration Plan)
