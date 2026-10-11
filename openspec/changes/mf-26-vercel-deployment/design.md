## Context

The application is built on Next.js 16 (App Router) and deployed serverless on Vercel (`OPS-vercel`). Continuous Integration is implemented in `.github/workflows/ci.yml` (`OPS-ci-cd`) with two parallel jobs: `checks` (lint, typecheck, Vitest coverage) and `e2e` (Playwright against an isolated Neon test schema).

The Vercel project is created (`menu-finder-mbs`), connected to the GitHub repository through Vercel for GitHub, and its production environment variables are stored in Vercel, for Production only.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Enforce strict HTTP security headers per `context/safety-first.md §2.4`: fixed headers on every route via `next.config.ts`, and a nonce-based CSP on every page via `src/proxy.ts`.
- Deploy to production only when the author moves the `production` branch, and only after `checks`, `e2e` and `release` pass on that commit (*test → build → deploy*). Merging a PR into `main` does not deploy.
- No deployment from any other branch: no previews, no deploy on `main`.
- Test and verify security headers with automated unit tests.

**Non-Goals:**
- Neon database migration in production (owned by MF-46 with `pnpm ingest migrate`).
- Seeding or creating demo accounts in production (owned by MF-46 with `pnpm ingest account`).
- Custom DNS management beyond the verified `menu-finder-mbs.vercel.app` domain.

## Decisions

### D1: Fixed Headers in `next.config.ts`, CSP in `proxy.ts`
- **Choice:** The four fixed headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) are declared in `next.config.ts` through the `headers()` hook, on `/:path*`. The `Content-Security-Policy` is set in `src/proxy.ts` (Next.js 16 renamed middleware to Proxy), because its nonce changes on every request (D2).
- **Why:** Declarative headers in `next.config.ts` reach every response, pages, API routes and static assets alike, without running code per request, and the configuration export can be unit tested. A per-request nonce cannot be declared statically, so the CSP needs the proxy.
- **Matcher:** The proxy uses the matcher of the Next.js 16 CSP guide (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`): every path except `api`, `_next/static`, `_next/image`, `favicon.ico` and `next/link` prefetches. The CSP only protects HTML documents, so API responses and static assets do not need it.
- **Location** (decided by the author on 2026-10-11): `src/proxy.ts` is a thin entry that only exports `proxy` and `config.matcher` (Next.js reads the matcher statically, so it stays there). The logic lives in the web adapter, in `src/app/content-security-policy.ts` (a plain file in `app/`, like `app-version.ts`: only special names such as `page` or `route` are routed), whose only export, `withContentSecurityPolicy`, builds the policy and sets it on the request and the response; its steps are private helpers in the same file. A separate, exported builder was tried and merged back: it had a single caller, and the tests check every directive on the response anyway. The CSP is a rule of HTTP responses, not of the system, so nothing of it goes to `domain/`, `application/` or `infrastructure/`. ESLint gives `src/proxy.ts` the file category `web-entry` with the same dependency rules as `app/`, and ADR-001 §2 lists it (sixth amendment).
- **Alternative considered:** All the headers in `proxy.ts`. Rejected: the fixed headers would then depend on the proxy matcher and would miss API routes and static assets.

### D2: Content Security Policy with a Per-Request Nonce
- **Choice** (decided by the author on 2026-10-11):
  - `default-src 'self'`
  - `script-src 'self' 'nonce-<value>' 'strict-dynamic'`, plus `'unsafe-eval'` only when `NODE_ENV` is `development`: React needs `eval` only in development for debugging, and neither React nor Next.js use it in production (Next.js 16 CSP guide). No `'unsafe-inline'`.
  - `style-src 'self' 'unsafe-inline'`
  - `img-src 'self' data:`
  - `font-src 'self'`
  - `object-src 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
  - `frame-ancestors 'none'`

  The proxy generates the nonce from `crypto.randomUUID()` on every request and sets the CSP on the request headers, where Next.js reads it to attach the nonce to its own scripts while rendering, and on the response headers.
- **Why:** Only scripts that carry the nonce of the current request run, so an injected inline script is blocked (OWASP A05:2025 Injection). The policy also blocks scripts, objects and frames from other origins, injected `<base>` tags, form submissions to other origins and clickjacking (OWASP A02:2025 Security Misconfiguration). The cost the guide warns about, losing static rendering, does not apply: every page already renders dynamically because it reads the session, and the last build prerendered only `/_global-error` and `/_not-found` (`.next/prerender-manifest.json`).
- **Residual risk:** `style-src` keeps `'unsafe-inline'`, so an injected inline style is not blocked. Accepted: a style cannot run code, and React's output escaping remains the first barrier (`context/safety-first.md §2.1`).
- **Alternatives considered:**
  - `'unsafe-inline'` in `script-src`, without nonces. Rejected: injected inline scripts would run.
  - Hashes (`'sha256-…'`) or the experimental Subresource Integrity support of Next.js 16. Rejected: the inline scripts Next.js writes carry the data of each request, so their hashes cannot be computed at build time, and SRI exists to keep pages static, which this app does not have.
  - The nonce in `style-src` too, as the guide's example does in production. Rejected: a nonce does not cover `style` attributes, and `src/features/shopping-list/components/progress-bar.tsx` sets one.

### D3: Vercel Builds the `production` Branch, Held by Deployment Checks
- **Choice** (decided by the author on 2026-10-11): Vercel for GitHub builds and deploys the project's Production Branch, set to `production` in the Vercel dashboard. Deployment Checks hold each production deployment until the GitHub Actions jobs `checks`, `e2e` and `release` pass on its commit; only then is it promoted to `menu-finder-mbs.vercel.app`. No Vercel CLI, no deploy job and no Vercel token in GitHub.
- **Why:** The pipeline keeps *test → build → deploy*: a commit that fails a check never reaches production. Nothing new enters the dependency tree, and the deployment token leaves GitHub, which removes the most sensitive secret of the pipeline.
- **Cost:** Vercel builds, not CI, so the project's Node.js version in Vercel must match the CI's (24). The build runs the same `pnpm install --frozen-lockfile` and `next build`, but on Vercel's machine.
- **Alternatives considered:**
  - The Vercel CLI pinned as a devDependency, running `vercel build` and `vercel deploy --prebuilt` in a CI job. Implemented first and rejected: `vercel@62.0.0` added about 2,800 lines to `pnpm-lock.yaml` and some 35 advisories that OSV-Scanner fails the PR on (`tar`, `undici`, `path-to-regexp`, `js-yaml`, `smol-toml` and others; the two `sandbox` ones are false positives against an unrelated 2020 package of the same name). The latest release, 63.1.2, pulls the same versions, so updating does not help.
  - The same CLI in its own `deploy/package.json` and lockfile, or accepting the advisories in `osv-scanner.toml`. Rejected by the author: both keep a large, vulnerable tree in the job that holds the token, and only change where it is documented.
  - A Vercel Deploy Hook called from CI. Rejected: it builds the tip of a branch, not a given commit, and still needs the Git connection.

### D4: Release by Moving the `production` Branch
- **Choice:** A release bumps `version` in `package.json` in a PR. Once merged, the author tags the commit and moves `production` to it:
  ```
  git tag v0.1.0 && git push origin v0.1.0
  git push origin v0.1.0:production
  ```
  `ci.yml` runs on pushes to `production` as well as `main`, so `checks` and `e2e` run again on that commit. A `release` job, only on `production`, fails unless the commit is already in `main` (`git merge-base --is-ancestor`) and the tag `v<version of package.json>` points to it. Nobody commits on `production`: it only moves forward to commits of `main`.
- **Why:** Merging a PR does not guarantee a working `main`: two PRs that pass separately can fail together. The author decides when to publish, the full suite runs on the exact commit that is deployed, and the tag records which version is in production. The `release` job makes Deployment Checks refuse a commit that is not in `main` or whose tag does not match `package.json`.
- **Alternatives considered:**
  - Deploy on every push to `main`. Rejected by the author: a merge that breaks `main` would reach production.
  - A tag push as the trigger. Vercel for GitHub deploys branches, not tags, so it would need the CLI (D3).

### D5: Vercel Configuration via `vercel.json` (Git Governance and Function Region)
- **Choice:** `vercel.json` with `"git": { "deploymentEnabled": { "**": false, "production": true } }` and `"regions": ["fra1"]`.
- **Why:**
  1. Only `production` deploys. A branch that matches several rules deploys if any of them is `true` (Vercel's Git configuration docs), so `production` deploys and every other branch (`**`, not `*`: in minimatch `*` does not cross `/`, so `feature/…` and `dependabot/…` branches would still deploy), `main` and PR branches included, does not. With no previews, the rule of `context/safety-first.md §2.4` that previews be access-protected and use their own Neon branch is met by omission.
  2. Colocates Vercel Serverless Functions in Frankfurt (`fra1`) with the Neon PostgreSQL database (`eu-central-1`), eliminating ~80–100ms of transatlantic network roundtrip latency per database query.
- **Alternative considered:** Configuring "Ignored Build Step" and function regions in Vercel project dashboard manually. Rejected because repository-as-code (`vercel.json`) ensures the configuration is version-controlled, reproducible, and transparent. The Production Branch and the Deployment Checks have no `vercel.json` option, so they are set in the dashboard (tasks).

### D6: `package.json` Version as the Visible Version
- **Choice** (decided by the author on 2026-10-11): `"version"` in `package.json` is the only source of the version. A release bumps it in a PR and tags the merged commit `v<version>`; the `release` job checks that the tag matches (D4). `next.config.ts` reads the version from `package.json` and inlines it at build time through its `env` option. Only server code reads it: the layouts that mount the shell pass it to `AccountMenu` as a prop, next to the email, and the panel shows "Versión v<version>". `next.config.ts` also sets `poweredByHeader: false`.
- **Why:** The author needs to confirm, after a release, that the pages served come from that version, and to see the version in the code. With `package.json` as the source and the tag checked against it, the field, the tag and the menu never disagree. Sentry will tag errors with the same value as `release` when MF-32 adds it. Reading the value only on the server keeps it out of the public JavaScript bundles: `AccountMenu` is a client component, and a value read there would be inlined into a chunk anyone can download.
- **Verification note:** a tab opened before a deploy keeps the old client code until it is reloaded; the version in the menu is always the one the server rendered, so the check is made after reloading.
- **Alternatives considered:**
  - The tag as the only source, passed to the build as an environment variable. Rejected: `package.json` `version` would stay at `0.1.0` while the tags move on, a field that misleads whoever reads it.
  - An `X-App-Version` header on every response. Rejected: anyone, without an account, would see which commit of the public repository is deployed, and checking it needs DevTools or `curl`.

## Risks / Trade-offs

- **[Risk: CSP breaks Next.js client-side navigation or inline styles]** → Mitigation: Tested via local build, Vitest unit tests on `next.config.ts`, on `withContentSecurityPolicy` and on the proxy matcher, and the Playwright E2E suite, which runs against `pnpm build && pnpm start`, before pushing.
- **[Risk: `src/proxy.ts` is not classified in ADR-001]** → Mitigation: check that the `eslint-plugin-boundaries` rules accept it as part of the web adapter before writing it; if they do not, propose its classification to the author instead of silencing the rule.
- **[Risk: the CSP blocks Sentry]** → `default-src 'self'` will block the browser from sending events to Sentry when MF-32 adds it. MF-32 will need a `connect-src` entry for Sentry or a tunnel route.
- **[Risk: Deployment Checks not set, or set to the wrong jobs]** → production would deploy without waiting for CI. Mitigation: the first release is checked by hand in the dashboard (the deployment waits for `checks`, `e2e` and `release`) before it is trusted.
- **[Risk: someone pushes a commit straight to `production`]** → Mitigation: the `release` job fails for a commit that is not in `main`, and Deployment Checks hold it; branch protection on `production` can forbid direct pushes.
