# Design

## Context

See proposal.md for motivation. Current state: `src/instrumentation.ts` starts Sentry on the server and `src/instrumentation-client.ts` in the browser, both with the shared `NOTHING_FROM_REQUESTS`. `src/app/layout.tsx` is the root layout (font, `globals.css`, `await connection()`). No `error.tsx` or `global-error.tsx` exists. The Next.js 16.3 docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`) say: error boundaries are Client Components; the props are `error` and `retry` (not `reset`); `error.tsx` does not wrap the layout above it; `global-error.tsx` replaces the root layout, so it defines `<html>` and `<body>` and gets none of the global styles.

## Goals / Non-Goals

**Goals:** render errors reach Sentry and show a controlled screen; events are tagged by environment.

**Non-Goals:** Session Replay, `setUser`, Sentry's `ErrorBoundary` component, per-route `error.tsx` files, `not-found.tsx`, error screens for server actions (they return typed results already), a `release` option.

## Decisions

**D1. Use the file conventions with `Sentry.captureException`, not `Sentry.ErrorBoundary`.** The example project wraps the app in `Sentry.ErrorBoundary`. In the App Router, Next.js installs its own boundaries and `error.tsx`/`global-error.tsx` is the supported place; a second boundary in `layout.tsx` (a Server Component) would be redundant. Alternative: a client boundary component around `children`. Rejected: it misses layout errors and duplicates Next.js.

**D2. Two files.** `error.tsx` covers pages and keeps the layout, font and styles. `global-error.tsx` is only for root layout failures, rare but otherwise unrecoverable. Alternative: only `global-error.tsx`. Rejected: every page error would replace the whole document with an unstyled page.

**D3. Report in `useEffect` keyed on `error`.** Calling `captureException` during render would repeat on every re-render; the effect runs once per error instance. Only the error is passed: no tags, extras or user.

**D4. The fallback is fixed Spanish text, with no `error.message`, stack or digest.** Errors from Client Components reach the boundary with their original message, which can carry internals. Sentry holds the real error. Alternative: show the digest for support. Rejected: no support channel in a closed system.

**D5. `global-error.tsx` does not depend on `globals.css` or the font.** It renders outside the root layout, so it uses a few inline styles with neutral values; the CSP allows them (`style-src 'unsafe-inline'`, `src/app/content-security-policy.ts`). It adds no script of its own: Next.js stamps its scripts with the nonce. Whether it can import `globals.css` instead is an open question (below); the spec does not depend on it.

**D6. `environment` from `VERCEL_ENV`, falling back to `NODE_ENV`.** `VERCEL_ENV` distinguishes preview from production; `NODE_ENV` is `production` in both. One pure function, `sentryEnvironment(env)`, in `src/app/sentry-environment.ts` next to `sentry-data-collection.ts`, is the single definition. `next.config.ts` inlines `SENTRY_ENVIRONMENT` in its `env` block (as it does with `SENTRY_DSN`) and `instrumentation-client.ts` reads that; the server reads `process.env` through the same function. Alternative: a `NEXT_PUBLIC_` variable set by hand in Vercel. Rejected: one more variable to forget.

**Assumption to confirm with the author:** the labels are exactly Vercel's three. If another label is wanted, only `sentry-environment.ts` changes.

## Risks / Trade-offs

- [`global-error.tsx` is hard to trigger] → unit test with a mocked `Sentry`; the real check is one forced error in a Vercel preview (last task).
- [A render error loop sends many events] → once per instance, plus Spike Protection and the monthly quota (MF-22.2).
- [`next dev` shows Next's own overlay, not these screens] → check with `next build` and `next start`.

## Open Questions

- Whether `global-error.tsx` can import `globals.css` under the nonce CSP (D5). Answered during `apply` with a production build; the result is noted in the task.
