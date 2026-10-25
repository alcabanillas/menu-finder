# Tasks

Decisions of the author, 2026-10-16 (`proposal.md`): browser only, `tracesSampleRate` 1.0, page loads and navigations, Speed Insights removed. Each test task comes first and is seen failing before its implementation task (PROC-tdd). During `apply`, run `pnpm typecheck` and only the affected tests; the full lint runs in the pre-push (`AGENTS.md`).

## 1. Roadmap

- [x] 1.1 Add the MF-67 item to `context/roadmap.md` with the estimate and the **Resultado** (Web Vitals visible in Sentry after a release, Speed Insights gone), and the author's date. Verify: the item exists and its ID matches the change name.

## 2. Span and transaction cleaning (spec "Web Vitals without request data")

- [x] 2.1 Test first: unit tests for the cleaning function. A span or transaction with `?startsOn=2026-10-12` in its URL attributes/fields, a user, cookies and headers comes out with none of them; a clean span/transaction comes out unchanged; route name `/menu` kept. Verify: the tests run and fail.
- [x] 2.2 Implement the function in `src/app/` next to `NOTHING_FROM_REQUESTS`, named after what it does, with the exported function first and its helpers below. Verify: the tests of 2.1 pass.

## 3. Browser options (specs "Browser errors reach Sentry" and "Trace headers stay on the app's own origin")

- [x] 3.1 Test first, in `src/instrumentation-client.test.ts`: replace "sends errors only" with: `tracesSampleRate` above 0 and at most 1, no replay options, no replay integration, explicit same-origin `tracePropagationTargets: ['localhost', /^\//]`, the cleaning function hooked up to Sentry options, and no DSN sends nothing. Keep the DSN and `dataCollection` tests. Verify: the new test fails.
- [x] 3.2 Update `src/instrumentation-client.ts`: `tracesSampleRate: 1`, `tracePropagationTargets: ['localhost', /^\//]`, the cleaning hook, and the header comment that now says "errors and Web Vitals". Verify: the tests of 3.1 pass.
- [x] 3.3 Test first: `src/instrumentation.test.ts` still asserts the server has no `tracesSampleRate` or `tracesSampler` (spec "No server tracing"); rename its test to say so. Verify: it passes before and after, and `src/instrumentation.ts` is unchanged (`git diff`).

## 4. Navigation transactions (design D3)

- [x] 4.1 Test first: update `src/instrumentation-client.test.ts` mock to include `captureRouterTransitionStart: vi.fn()` and assert the module exports `onRouterTransitionStart`; `next.config.test.ts` asserts `sentryBuildOptions` no longer sets `suppressOnRouterTransitionStartWarning`. Verify: both fail.
- [x] 4.2 Export `onRouterTransitionStart` from `src/instrumentation-client.ts` and drop the option from `sentryBuildOptions` in `next.config.ts`, with its comment. Verify: the tests of 4.1 pass.

## 5. CSP and failure behavior (spec "Performance telemetry never breaks the page")

- [x] 5.1 Test: `src/app/content-security-policy.test.ts` asserts that, with a valid https DSN, `connect-src` is exactly `'self'` plus the DSN origin. Verify: it passes without changing `content-security-policy.ts` (the policy was already built in MF-22.2).
- [x] 5.2 Test: with the ingest host blocked (a Playwright route that aborts requests to it, `page.route('**/*.ingest.sentry.io/**', route => route.abort())`), `/login` renders and a protected action answers as before. Verify: the e2e passes.

## 6. Remove Speed Insights (design D6)

- [x] 6.1 Test first: `src/app/layout.test.tsx` asserts the layout renders no Speed Insights script. Verify: test fails.
- [x] 6.2 Remove `<SpeedInsights />` and its import from `src/app/layout.tsx`, and run `pnpm remove @vercel/speed-insights`. Verify: the tests of 6.1 pass, `pnpm typecheck` passes and `pnpm knip` reports nothing new.

## 7. Docs and release checks

- [x] 7.1 Update `context/decisiones.md` §1.2 OPS-observabilidad: errors plus browser Web Vitals from Sentry; replace "sin trazas de rendimiento" and the Speed Insights sentence. Verify: `grep -n "trazas de rendimiento" context/decisiones.md` shows no stale claim, and the section cites this change.
- [x] 7.2 Run `pnpm test:coverage` and go through the checklist of `context/seguridad/safety-first.md` §4, recording the result in the PR. Ask the author whether the PR bumps `"version"` in `package.json` (`AGENTS.md`). Verify: coverage thresholds pass.
- [ ] 7.3 After the release, load `/planner` and `/menu` in production and check that Sentry's Web Vitals page lists document Web Vitals (LCP, INP, CLS, FCP) on pageload and transition duration on navigations, and that no span/transaction shows a query string. Verify: a screenshot or the list in the PR.

## Workflow follow-up

- `/opsx:verify`, then `/opsx:archive` once merged and checked in production.
