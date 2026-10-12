## Why

MF-40.5 (`context/roadmap.md`, item MF-40). The web has no error reporting: an exception in a page, a server action or a route handler is only in the Vercel function logs. OPS-observabilidad chose Sentry for production, and the author chose `@sentry/nextjs` on 2026-10-12. A prototype on the branch proved on 2026-10-12 that, with Genkit's OpenTelemetry off (MF-40.4), `Sentry.init()` registers its own tracer provider and a forced server error reached Sentry from Vercel production, with no user data.

The author narrowed the item on 2026-10-12: this change covers the Next.js server only. The CLI sends nothing to Sentry, because its failures are seen in the terminal and in the Developer UI. The browser, the edge runtime, the CSP, the source maps and the explicit capture of the typed Genkit failures move to MF-22, when Genkit reaches the web.

## What Changes

- `src/instrumentation.ts` starts Sentry in the Node.js runtime of Next.js, with the DSN from `SENTRY_DSN`, and exports `onRequestError = Sentry.captureRequestError`, so Next.js reports every uncaught server error.
- Errors only: no `tracesSampleRate` or `tracesSampler`, so no transaction or span is sent. With Genkit's OpenTelemetry off, the global tracer provider is Sentry's, and a Genkit span carries the request text (MF-40.4 design, Context).
- Sentry 11 has no `sendDefaultPii` (the roadmap text named it before the prototype). Its replacement, `dataCollection`, is set with every field off: user info, cookies, HTTP headers and bodies, URL query parameters, GraphQL documents and variables, AI inputs and outputs, database query data, queue data and stack frame variables.
- The edge runtime does not start Sentry yet (MF-22).
- ESLint classifies `src/instrumentation.ts` as an entry of the web adapter, like `src/proxy.ts`, and ADR-001 §2 lists it.
- `@sentry/nextjs` `11.6.0`, exact, as a dependency.
- `.vercelignore` keeps `data/`, `.env*` and the other local-only paths out of a deploy made with the Vercel CLI, which the author used for the prototype and which does not read `.gitignore`.
- OPS-observabilidad says that Sentry receives server errors only, without request data.

## Capabilities

### New Capabilities
- `error-reporting`: which errors of the web reach Sentry, and what an event may carry.

### Modified Capabilities
None.

## Impact

- **Code:** `src/instrumentation.ts` and its test; `eslint.config.mjs`.
- **Dependencies:** `@sentry/nextjs` `11.6.0` and its `@sentry/*` packages at the same version, with `@opentelemetry/api`. No Sentry package pulls `@opentelemetry/core` (`pnpm why @opentelemetry/core`, 2026-10-12: only the Genkit chain). `osv-scanner` checks them in CI.
- **Configuration:** `SENTRY_DSN` in Vercel, Production, already set by the author. `SENTRY_AUTH_TOKEN` is set too but unused until the source maps (MF-22). `.vercelignore`.
- **Documentation:** OPS-observabilidad in `context/decisiones.md`; ADR-001 §2.
- **Decisions it relies on:** OPS-observabilidad, SEG-datos-nutricionista, SEG-owasp, ARQ-hexagonal, ADR-001.
- **Contradictions to flag:**
  - The MF-40 parent item said that MF-40 checks the export of Genkit traces to Sentry, and MF-32 planned those traces. Since MF-40.4 there are none in production. At the author's request (2026-10-12), both items now say so, and MF-32 decides how to measure latency and cost without traces.
  - OPS-observabilidad says that errors are captured on the server and in the browser (decided 2026-10-11). The browser part now lands in MF-22.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* the error event: message, stack trace, runtime, URL path and release. The request text and nutritionist data can reach an event through bodies, headers, cookies, query strings, stack frame variables or AI inputs, so every `dataCollection` field is off (SEG-datos-nutricionista). Today the web has no free-text input apart from sign-in; MF-22 brings the search text.
  - *Abuses:* sensitive data leaking to a third party through error events (A09 Security Logging and Monitoring Failures, A02 Cryptographic Failures through exposed data). Tracing turned on later by mistake would send Genkit spans with the request text (LLM02 Sensitive Information Disclosure): a test fails if `tracesSampleRate` or `tracesSampler` appears. The DSN is public by design and only allows sending events.
  - *Not applicable:* authorization (A01) and input validation, because no endpoint or command is added.
