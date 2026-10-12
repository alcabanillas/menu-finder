## Why

MF-22.2 (`context/roadmap.md`, item MF-22). Since MF-40.5, Sentry receives the uncaught errors of the Next.js server, and nothing from the browser: the client never starts Sentry, and the Content-Security-Policy of MF-26 (`default-src 'self'`, no `connect-src`) would block the events anyway. `/planner` becomes interactive in MF-22.4, and an error there would be invisible. When a browser error does arrive, its stack trace points into minified bundles, so it says that something failed but not where. The author wants only uncaught exceptions here, kept simple (decided on 2026-10-12).

## What Changes

- **The browser starts Sentry** with errors only: no tracing, no Session Replay, and every `dataCollection` field off, as on the server (SEG-datos-nutricionista).
- **One variable for the DSN:** `SENTRY_DSN` stays the only one. `next.config.ts` inlines it into the browser bundle at build time, as it already does with `APP_VERSION`, so the server, the CSP and the browser read the same value and Vercel needs no new DSN variable. The DSN is public by design: it only lets someone send events, never read them.
- **The CSP gains `connect-src 'self' https://<host>`**, where `<host>` is the exact ingest host of the DSN, never a wildcard. A wildcard such as `*.ingest.de.sentry.io` would let an injected script send data to an attacker's own Sentry organisation. With no DSN, or an invalid one, the CSP stays as it is today. The author chose this on 2026-10-12 over Sentry's `tunnelRoute`, which would add a public endpoint with no session (SEG-sistema-cerrado).
- **Readable stack traces:** `withSentryConfig` uploads the source maps from the Vercel build and deletes them afterwards, so they are never served. A build without `SENTRY_AUTH_TOKEN` (local, CI) generates no source maps at all.
- **No edge runtime:** in Next.js 16 the proxy runs on Node.js, and no route declares `runtime = 'edge'`, so nothing needs Sentry there.
- **Dependency fix carried in this change:** a pnpm override takes `handlebars` to `^4.7.10` (Dependabot alert #18, GHSA-p8wg-vrv2-v86f, critical). It comes in transitively through `genkit`, `dotprompt` and `eslint-plugin-boundaries`, and 4.7.10 is a patch of the same major.
- **Manual steps for the author, in Sentry and Vercel:** Allowed Domains in the Sentry project, so that a copied DSN cannot send from another site. The free plan offers no rate limit per DSN key: Spike Protection, on in the project, and the monthly quota cap the spam, which at worst stops the reports until the month ends and costs nothing. In Vercel, `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` already exist; `SENTRY_PROJECT` is added, and `SENTRY_ORG` too unless the token is an organisation token.

Not here: the typed LLM failures, including the daily LLM limit, go to MF-22.3, where the web first calls the decomposer. The breadcrumbs go to MF-22.4, where searching and choosing a menu exist.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `error-reporting`: adds the browser errors and the source maps. The server requirements do not change.
- `security-headers`: the CSP lets the browser send events only to the exact Sentry ingest host of the DSN.

## Impact

- **Code:** `src/instrumentation-client.ts` (new), `src/instrumentation.ts`, a shared constant for `dataCollection`, `src/app/content-security-policy.ts`, `next.config.ts`, the `web-entry` pattern in `eslint.config.mjs`, `pnpm-workspace.yaml` and `pnpm-lock.yaml`. Tests next to each one, and an end-to-end test that the build serves no source map.
- **Dependencies:** none new. `@sentry/nextjs` 11.6.0 is already installed. `handlebars` moves to 4.7.10.
- **Configuration:** `SENTRY_PROJECT` in Vercel, and `SENTRY_ORG` if the token needs it. `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` are reused.
- **Size:** ~2 h, as in the roadmap.
- **Decisions it relies on:** OPS-observabilidad, SEG-owasp, SEG-datos-nutricionista, SEG-sistema-cerrado. `context/safety-first.md` §2.4 asks for a restrictive CSP: it stays restrictive, with one extra destination that belongs to the project.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* errors raised in the browser, with their stack traces. No user info, cookies, headers, bodies, query parameters or AI inputs (`dataCollection` off). No request text: the search UI does not exist yet, and MF-22.4 must keep it out of the breadcrumbs.
  - *Abuses:* an injected script exfiltrating data through `connect-src` (A05). The exact host limits the destination to the project's own Sentry organisation, and `script-src` keeps its nonce. Event spam with the public DSN, to exhaust the quota: Allowed Domains in Sentry, which stops browsers on other sites, plus Spike Protection and the quota of the free plan, which has no per-key rate limit. Source code exposed through source maps (A02): deleted after upload, never generated without a token, and checked by an end-to-end test. A vulnerable transitive dependency (A03): the `handlebars` override.
  - *Not applicable:* authorization (A01): no endpoint, no session change.
