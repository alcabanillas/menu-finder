# Design

## Context

See `proposal.md` - Why. State of the code, read on 2026-10-16:

- `src/instrumentation-client.ts` starts Sentry with only `dsn` and `dataCollection: NOTHING_FROM_REQUESTS`. `@sentry/nextjs` 11.6.0 adds `browserTracingIntegration` to the browser defaults unless `__SENTRY_TRACING__` is false (`node_modules/@sentry/nextjs/build/cjs/client/index.js:75-79`). It is already installed and idle: it does not sample without a `tracesSampleRate`.
- `next.config.ts` (`sentryBuildOptions`) sets `suppressOnRouterTransitionStartWarning: true`, "errors only, with no navigation tracing". The Next.js SDK needs an exported `onRouterTransitionStart` hook in `src/instrumentation-client.ts` to trace client navigations; without it only page loads are traced.
- `src/app/content-security-policy.ts` already puts the exact ingest origin of the DSN in `connect-src` (MF-22.2). Transactions use the same envelope endpoint as errors.
- Only `/menu` (`startsOn`) and `/shopping-list` (`vista`) read a query parameter.

No port is needed: this is configuration of the Sentry SDK at the web entry point, not a boundary of the core (ADR-001, `AGENTS.md` "reuse a port before creating one").

## Goals / Non-Goals

**Goals:**
- Page-load and navigation transactions from the browser with LCP, INP, CLS and FCP.
- No new field about the visitor or the request in any event.
- The change is reversible by one option.

**Non-Goals:**
- Server tracing, Genkit or database spans, Session Replay, profiling.
- LLM latency and cost: that stays in MF-32.
- Alerts or dashboards in Sentry (set by hand).

## Decisions

These are technical, and they follow from the specs. The four choices that are the author's are in `proposal.md`, "Decisions of the author".

**D1. A shared function cleans each transaction before it is sent.** `beforeSendTransaction` removes the query string from the transaction's URL fields and drops any user, cookie or header field, in a pure function next to `NOTHING_FROM_REQUESTS` in `src/app/`, with unit tests. Alternative: trust `dataCollection` alone. Rejected: `dataCollection` is documented for request data of errors; a transaction is a different event type, and the spec scenario "Transaction fields checked before sending" needs a check we can test.

**D2. Trace headers only on the app's own origin.** Set `tracePropagationTargets` to same-origin patterns (the SDK default is `localhost` plus same-origin paths, so it is made explicit). Alternative: leave the default. Rejected: the default can change between SDK versions, and the spec requires that no third party gets the headers. The app calls Gemini and Neon from the server only, so no browser request goes to them; the rule protects against a future change.

**D3. Navigation transactions need the router hook.** Export `onRouterTransitionStart = Sentry.captureRouterTransitionStart` from `src/instrumentation-client.ts` and remove `suppressOnRouterTransitionStartWarning` from `sentryBuildOptions`, with the test in `next.config.test.ts` that asserts it. Alternative: page loads only. The author chose page loads and navigations (2026-10-16).

**D4. The server file does not change.** `src/instrumentation.ts` keeps its options and its test (`src/instrumentation.test.ts:34`). Browser and server share only `NOTHING_FROM_REQUESTS`.

**D5. Sample rate is a constant in `src/instrumentation-client.ts`, not an environment variable.** One value to read and to test. Alternative: `SENTRY_TRACES_SAMPLE_RATE` from the environment. Rejected for now: the browser value has to be inlined at build time (as `SENTRY_DSN` is in MF-22.2), which adds a variable for one number. The author chose 1.0 (2026-10-16).

**D6. Speed Insights is removed.** Delete `<SpeedInsights />` and its import from `src/app/layout.tsx`, and run `pnpm remove @vercel/speed-insights`. No spec covers it, and the CSP needs no change (it used `'self'`). The Vercel dashboard keeps its past data; stopping the component stops new data. Alternative: keep both. Rejected by the author (2026-10-16).

## Risks / Trade-offs

- [Monthly Sentry quota used by transactions] → a sample rate below 1 if the author chooses; Spike Protection already on.
- [A transaction name with a dynamic value, such as a date in the path] → no route has one today; the spec scenario with `?startsOn=` and the unit test of D1 guard it.
- [Web Vitals from a very small user base are noisy] → the dashboard shows a distribution; the TFM presentation reports it as indicative.
- [Ad blockers drop the transactions] → accepted; the page is unaffected (spec "Performance telemetry never breaks the page").
- [The SDK sends the user agent with the transaction] → it is browser and OS data, not user data; the proposal lists it. If the author does not accept it, D1 drops it.
- [Losing the Real Experience Score] → accepted by the author: Sentry's Web Vitals replace it.

## Migration Plan

1. Merge. Vercel builds from `production` only on release (`pnpm release`, `context/despliegue.md`), so production changes at the next release.
2. After the release, open the app and load `/planner` and `/menu`; the Sentry "Web Vitals" page lists them within minutes.
3. Rollback: remove `tracesSampleRate` (one line) and release; the browser goes back to errors only.

## Open Questions

None. The four questions of the proposal are answered in `proposal.md`, "Decisions of the author".
