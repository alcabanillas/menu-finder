## 1. Environment label (TDD: test first, see it fail)

- [x] 1.1 Test `sentryEnvironment` in `src/app/sentry-environment.test.ts`: `production`, `preview`, fallback to `NODE_ENV` when `VERCEL_ENV` is unset, fallback when it is an empty string
- [x] 1.2 Implement `sentryEnvironment(env)` in `src/app/sentry-environment.ts`
- [x] 1.3 Test that `src/instrumentation.test.ts` and `src/instrumentation-client.test.ts` expect `environment`; the server reads `process.env`, the browser reads the inlined `SENTRY_ENVIRONMENT`
- [x] 1.4 Pass `environment` in both `Sentry.init` calls
- [x] 1.5 Test in `next.config.test.ts` that `env.SENTRY_ENVIRONMENT` is inlined from `VERCEL_ENV`; add it to `next.config.ts`

## 2. Page error boundary (TDD)

- [x] 2.1 Test `src/app/error.test.tsx` with Testing Library and a mocked `@sentry/nextjs`: reports once, re-render does not report again, "Try again" calls `retry`, message and digest not shown, only the error is passed to `captureException`
- [x] 2.2 Implement `src/app/error.tsx` (Client Component, fixed Spanish text, design-system classes)

## 3. Root layout error boundary (TDD)

- [x] 3.1 Test `src/app/global-error.test.tsx` with the same cases, plus that it renders its own `<html>` and `<body>`
- [x] 3.2 Implement `src/app/global-error.tsx` with inline styles; try `import '@/app/globals.css'` in a production build and keep it only if it works under the CSP (design open question); note the result here. Result (production build, 2026-10-18): the stylesheet loads with no CSP violation (`style-src 'self'`), but it only adds Tailwind's preflight (the `h1` drops to 16px) and not the Archivo font, which needs the layout's `<html>` class; kept inline styles, no import

## 4. Knip and coverage

- [x] 4.1 Check `pnpm knip` accepts the new files and `pnpm test:coverage` still meets the thresholds (`global-error.tsx` and `error.tsx` are Next page files, excluded from coverage by `context/decisiones.md` OPS-calidad)

## 5. Documentation

- [x] 5.1 One sentence in `context/decisiones.md` OPS-observabilidad: render errors reach Sentry through `error.tsx` and `global-error.tsx`, and events carry `environment`
- [x] 5.2 Remove the stale mention if any of "sin error boundary" in `context/` (check first with grep). Result: grep of context/ found none

## 6. Verification

- [x] 6.1 `pnpm typecheck` and `pnpm test:run` on the touched files; `pnpm exec eslint <files> --rule "import/no-cycle: off"`
- [x] 6.2 `next build` and `next start`: force a render error in a page and see the `error.tsx` fallback; the event reaches Sentry with `environment`. Result (2026-10-18): with `next start`, a throwing page shows the `error.tsx` fallback and a throwing root layout shows `global-error.tsx`. There is no Vercel preview (only production deploys), so the event was checked with `pnpm dev` and the `SENTRY_DSN` of `.env.local`: both boundaries sent one event each, seen by the author in Sentry with `environment: development`. Two local blockers, neither in the code: the Sentry project's Allowed Domains rejected `http://localhost:3000` (403 "Cors") until the author added it for the test; and the server event from `onRequestError` is captured but not sent behind Netskope, because Node rejects its TLS certificate (`SELF_SIGNED_CERT_IN_CHAIN`); `NODE_USE_SYSTEM_CA=1` makes Node trust the Windows store and fixes it. Vercel is not affected
- [x] 6.3 Before `gh pr create`: ask the author whether the PR bumps `"version"`, run `pnpm test:coverage`. Result: no version bump (author); coverage passes the thresholds
