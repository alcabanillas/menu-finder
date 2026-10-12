## Context

Checked in the installed `@sentry/nextjs` 11.6.0 and on Vercel on 2026-10-12:

- `Sentry.init()` from `@sentry/nextjs` in the Node.js runtime registers a `SentryTracerProvider` and a `SentryPropagator`. Genkit's `NodeSDK` stays off since MF-40.4, so Sentry's provider is the global one, and the spans Genkit creates go to it.
- Sentry 11 removed `sendDefaultPii`. `dataCollection` replaces it, and by default it collects bodies, headers, cookies, stack frame variables and AI inputs and outputs. The first Vercel build of the prototype failed on `sendDefaultPii`.
- Without a DSN the client sends nothing (`@sentry/core` `client.js`, "No DSN provided, client will not send events"), so local runs and tests send nothing.
- `captureRequestError` is exported for the `onRequestError` hook of Next.js.
- A forced server error behind sign-in reached Sentry from Vercel production: issue `MENU-FINDER-2`, environment `production`, `handled: no`, `Users: 0`. The stack trace was minified, because there are no source maps yet.
- The web has no free-text input apart from sign-in: `/menu` and `/shopping-list` read a date and a view name from the query string. The search text comes with MF-22.

## Goals / Non-Goals

**Goals:**
- Every uncaught server error of the web reaches Sentry.
- No event carries request data, and nothing but errors is sent.

**Non-Goals (MF-22, decided by the author on 2026-10-12):**
- Browser and edge errors, and the CSP change they need.
- Source maps uploaded from Vercel (`withSentryConfig`, `SENTRY_AUTH_TOKEN`).
- Explicit capture of the typed Genkit failures (`decomposer-failed`, `embedding-failed`).
- Any Sentry in the CLI.

## Decisions

**D1. `src/instrumentation.ts`, the Next.js hook.** `register()` starts Sentry when `NEXT_RUNTIME === 'nodejs'`, and the file exports `onRequestError = Sentry.captureRequestError`. Next.js requires the file next to `app/`. ESLint gives it the `web-entry` category of `src/proxy.ts` (MF-26), so it has the same import rules as `app/`, and ADR-001 §2 lists it. No port: there is no use case that reports errors, and the hook is Next.js wiring. A port comes in MF-22, if the web adapter reports the typed failures.

**D2. `dataCollection` with every field written out.** Each field of Sentry 11.6.0 is set explicitly, not through a shared preset. A `satisfies` check against `NodeOptions['dataCollection']` catches a renamed or removed field at compile time. It does not catch a field Sentry adds later, because every field is optional, and the test does not either: a new field would take its default. What guards against that is the exact pin of `@sentry/nextjs` and a review of the Sentry changelog on every upgrade. Alternative: a `beforeSend` that strips the request data. Rejected: it runs after the data is collected, and every new source needs its own rule.

**D3. Tests mock `@sentry/nextjs`.** `src/instrumentation.test.ts` replaces it with `vi.mock` and checks what `init` receives: called once in `nodejs` with the DSN, not called in `edge`, no tracing options, every `dataCollection` field. It checks that `onRequestError` is `captureRequestError`. That an event really reaches Sentry was seen on Vercel (Context); it is not automated.

**D4. `.vercelignore` stays.** The Vercel CLI uploads the working directory and documents only `.vercelignore`. The file repeats the local-only paths of `.gitignore`, `data/` first (SEG-datos-nutricionista). Deploys through Git do not need it, but the author deployed with the CLI during the prototype.

**D5. OPS-observabilidad.** "Sentry recoge errores y trazas" becomes server errors only, without request data (MF-40.5), with the browser in MF-22. "Qué viaja a Sentry" drops the structure of each LLM run: no span reaches Sentry.

## Risks / Trade-offs

- **Tracing turned on later sends the request text.** Genkit spans go to Sentry's provider and carry the input and output of each action. → The test fails if `tracesSampleRate` or `tracesSampler` appears; OPS-observabilidad says why.
- **Console breadcrumbs.** The Node SDK records `console.*` calls as breadcrumbs of the next event. No web code logs request data today. → MF-22 must keep the search text out of `console.*`, as it already does for the event fields.
- **Minified stack traces** until MF-22 uploads the source maps.
- **`dataCollection` is new in Sentry 11.** A future version may add fields that default to on, and neither the type nor the test would notice. → D2: `@sentry/nextjs` is pinned exactly, and each Dependabot upgrade needs its changelog checked for new `dataCollection` fields.
