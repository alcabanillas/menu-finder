## Context

`src/instrumentation.ts` (MF-40.5) starts Sentry in the Node.js runtime with `SENTRY_DSN` and a `dataCollection` constant with every field off, typed as `Sentry.NodeOptions['dataCollection']`. The type itself comes from `@sentry/core` (`Options.dataCollection`), so the browser SDK takes the same shape.

`src/proxy.ts` sets the CSP of every page through `withContentSecurityPolicy` (`src/app/content-security-policy.ts`, MF-26). That function builds the policy from a nonce and `NODE_ENV`. The policy has `default-src 'self'` and no `connect-src`.

In Next.js 16 the proxy runs on Node.js (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`, "Runtime"), and no file in `src/` declares `runtime = 'edge'`. ESLint's `boundaries/files` rule lists the root entries in `src/{proxy,instrumentation}.ts`. The end-to-end suite (`e2e/security-headers.spec.ts`) runs against a production build and already scans the public bundles.

## Goals / Non-Goals

**Goals:**
- Uncaught browser errors reach Sentry with readable stack traces, under the same data rules as the server.
- The CSP stays restrictive: the browser can send events to one exact host only.

**Non-Goals:**
- The typed LLM failures, including the daily LLM limit, go to MF-22.3. The breadcrumbs of searching and choosing a menu go to MF-22.4.
- Tracing, Session Replay and the router-transition hook. With no tracing, `onRouterTransitionStart` has nothing to do, so its build warning is suppressed.
- Sentry in the edge runtime: nothing runs there.

## Decisions

### D1. `src/instrumentation-client.ts`, errors only

The file Next.js loads before the app becomes interactive calls `Sentry.init` with the DSN, the shared `dataCollection` and no tracing or replay options. The default browser integrations stay: global error and unhandled-rejection handlers, and default breadcrumbs. `urlQueryParams: false` does not reach the URL of a browser event or the navigation and fetch breadcrumbs: the browser SDK does not gate them by `dataCollection` (`@sentry/browser`, `integrations/httpcontext.js`). The query parameters of the page therefore reach Sentry. The production check showed it, and the author accepted it on 2026-10-13, since today no URL of the app carries user text. MF-22.4 must keep the text of a search out of the URL.

The file is added to the `web-entry` pattern of `eslint.config.mjs`, next to `proxy` and `instrumentation`.

### D2. One shared `dataCollection`

The constant moves out of `instrumentation.ts` into `src/app/sentry-data-collection.ts`, typed with the `DataCollection` shape of `@sentry/nextjs`, and both entries import it. Without this, a field turned off on one side could stay on the other.

*Alternative:* copy the constant into the client file. This was rejected because the server and browser rules would drift apart, which is exactly what `SEG-datos-nutricionista` must prevent.

### D3. `SENTRY_DSN` stays the only variable, inlined for the browser

`next.config.ts` already inlines `APP_VERSION` through `env`. It does the same with `SENTRY_DSN`, so the browser bundle gets the value at build time. The server and the CSP keep reading `SENTRY_DSN` at runtime. There is one variable, Vercel already has it, and the server requirement of `error-reporting` does not change. The DSN is public by design: Sentry treats it as an identifier for sending, not as a secret.

The value is fixed in each build. On Vercel every deploy is a new build, so changing the DSN only needs a redeploy.

*Alternative:* `NEXT_PUBLIC_SENTRY_DSN` everywhere, removing `SENTRY_DSN`. This was rejected because it means a rename in Vercel and a migration step for the same result (decided by the author on 2026-10-12).

*Alternative:* `NEXT_PUBLIC_SENTRY_DSN` in the browser and `SENTRY_DSN` on the server. This was rejected because two variables with the same value end up out of sync.

### D4. `connect-src` from the DSN origin, never a wildcard

`contentSecurityPolicy` gains the DSN as an input. It parses the DSN with `URL`, keeps it only if its protocol is `https:`, and uses `url.origin`. That origin has no user info and no path, so neither the public key nor the project id reaches the header. It also cannot carry a `;`, so a malformed DSN cannot inject a directive. Any other case adds no `connect-src`, and the policy is exactly today's.

`'self'` goes first in the directive: an explicit `connect-src` replaces `default-src` for connections, and the app needs its own origin for server actions and RSC requests.

*Alternative:* Sentry's `tunnelRoute`. This was rejected because it adds a public endpoint with no session that forwards to Sentry, which conflicts with SEG-sistema-cerrado and would need its own rate limit (decided by the author on 2026-10-12).

*Alternative:* `https://*.ingest.de.sentry.io`. This was rejected because an injected script could then exfiltrate data to any Sentry organisation, the attacker's included.

### D5. Source maps only where they can be uploaded

`next.config.ts` is wrapped with `withSentryConfig`, with telemetry off and the build logs not silenced. `silent: true` was the first choice, but in `@sentry/nextjs` it also drops the errors (`config/buildLogger.js`): the first production build failed to upload its source maps, and neither the build nor its log said so. It passes neither `project`, `org` nor `authToken`: the Sentry build plugin reads `SENTRY_PROJECT`, `SENTRY_ORG` and `SENTRY_AUTH_TOKEN` from the environment itself, and an organisation token (`sntrys_…`) already carries the org. With a token, `sourcemaps.deleteSourcemapsAfterUpload` is `true`. Without one, `sourcemaps.disable` is `true`. Sentry deletes only the maps it generated itself and uploaded, so a build that cannot upload must not generate any. The end-to-end test that no `.map` is served is the guard against an SDK change in that behaviour.

The existing `next.config.test.ts` keeps checking the fixed headers and `poweredByHeader: false` through the wrapped config.

### D6. Manual steps, recorded and not automated

These are done by the author:

- **In the Sentry project:** Allowed Domains, under General Settings → Client Security, limited to the Vercel domain of the app. It only stops requests that carry an `Origin` or `Referer` header, that is, browsers on other sites. The free plan offers no rate limit on the DSN key, so Spike Protection, on in the project, and the monthly quota take its place: a flood of events at worst stops the reports until the month ends, at no cost.
- **In Vercel:** `SENTRY_DSN` and `SENTRY_AUTH_TOKEN` already exist. The author checks that the token can upload source maps, and adds `SENTRY_PROJECT`, plus `SENTRY_ORG` if the token needs it.

They live in account settings, outside the repository.

### D7. The `handlebars` override

`pnpm-workspace.yaml` gains `overrides: handlebars: ^4.7.10`, with a comment that names the advisory and says when to remove it. `pnpm update handlebars --depth Infinity` was tried first: it kept 4.7.9 and changed 230 lines of the lockfile. The override changes only `handlebars`.

## Risks / Trade-offs

- [An ad blocker drops the events of a browser] → Accepted: a TFM with few users, and the alternative is an anonymous endpoint (D4).
- [The source-map upload fails on Vercel, for example because of a wrong token scope] → The build still succeeds, and the stack traces stay minified until the token is fixed. The Source Maps page of Sentry in the manual check shows it.
- [A future Sentry SDK serves maps by default] → The end-to-end test fails before the release.
- [`SENTRY_PROJECT` is missing in Vercel] → The upload fails and the build still succeeds. The stack traces stay minified until the variable is added, and the manual check of step 2 below shows it.

## Migration Plan

1. Before the merge, the author adds `SENTRY_PROJECT` (and `SENTRY_ORG` if needed) in Vercel, and Allowed Domains in Sentry, and checks that Spike Protection is on.
2. After the release, an error thrown from the browser console of production shows up in Sentry with no request data, and Sentry lists the uploaded source maps. Console code is not in the bundle, so its stack trace cannot name a file in `src/`. That check moves to MF-22.4, the next subtask with UI: a temporary button that throws, removed in the same subtask (decided by the author on 2026-10-12). A preview deploy would not do, because its domain is outside the Allowed Domains.

Rollback: revert the merge. No variable is renamed, so the server keeps reporting errors either way.
