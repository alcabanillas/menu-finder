## Context

The application is built on Next.js 16 (App Router) and deployed serverless on Vercel (`OPS-vercel`). Continuous Integration is implemented in `.github/workflows/ci.yml` (`OPS-ci-cd`) with two parallel jobs: `checks` (lint, typecheck, Vitest coverage) and `e2e` (Playwright against an isolated Neon test schema).

The Vercel project is created (`menu-finder-mbs`), and production environment variables are stored in Vercel. Repository secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are configured in GitHub Actions.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Enforce strict HTTP security headers per `context/safety-first.md §2.4`: fixed headers on every route via `next.config.ts`, and a nonce-based CSP on every page via `src/proxy.ts`.
- Automate deployment to Vercel in `.github/workflows/ci.yml`, triggered only by pushing a version tag (`v*`) and strictly gated behind green `checks` and `e2e` runs on that tagged commit (*test → build → deploy*). Merging a PR into `main` does not deploy.
- Disable automatic Git-triggered deployments on Vercel so that GitHub Actions is the sole deployment authority.
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

### D3: Prebuilt Deployment via a Pinned Vercel CLI in CI
- **Choice:** Add `vercel` as an exact-version devDependency (recorded in `pnpm-lock.yaml`) and run it with `pnpm exec` in the `deploy` job, after `pnpm install --frozen-lockfile` on the same Node and pnpm setup as the other jobs:
  1. `pnpm exec vercel pull --yes --environment=production`
  2. `pnpm exec vercel build --prod`
  3. `pnpm exec vercel deploy --prebuilt --prod`

  The token reaches the CLI through the job's `env:` (`VERCEL_TOKEN`, with `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`), never as `--token`: when the flag is absent, the CLI reads `VERCEL_TOKEN` from the environment (checked in the bundle of `vercel@62.0.0`), so the token never appears on a command line. The pinned version is `62.0.0` (2026-09-30): `62.1.0` and `62.2.0` were within the 7-day window but are deprecated on npm for a self-upgrade bug.
- **Why:** The prebuilt pattern (`vercel build` followed by `vercel deploy --prebuilt`) builds with the Node and pnpm versions verified in CI, and Vercel only hosts the result. Pinning the CLI in the lockfile keeps it under the same supply-chain controls as every other package (`context/safety-first.md §2.5`): `--frozen-lockfile`, Dependabot with its 7-day cooldown and OSV-Scanner. The CLI runs with the deployment token, so an unexpected version is an OWASP A03:2025 risk. The version chosen at `apply` must have been published at least 7 days earlier (`OPS-ci-cd`).
- **Alternatives considered:**
  - `pnpm dlx vercel` without a version. Rejected: it resolves the latest release on every deploy, outside the lockfile.
  - `pnpm dlx vercel@x.y.z`. Rejected: the version is fixed, but outside the lockfile, Dependabot and OSV-Scanner, so nothing warns when it needs updating.
  - Third-party GitHub Actions (`amondnet/vercel-action`). Rejected: one more third-party dependency holding the token.

### D4: Release by Version Tag
- **Choice:** Production deploys are triggered by pushing a git tag that matches `v*` (for example `v0.1.0`). `ci.yml` adds `tags: ['v*']` to its `push` trigger. `checks` and `e2e` run again on the tagged commit, and the `deploy` job runs only when the ref is a version tag (`if: startsWith(github.ref, 'refs/tags/v')`) and both jobs passed (`needs: [checks, e2e]`). Before deploying, the job checks that the tagged commit is already in `main` (`git merge-base --is-ancestor`), so a tag on an unmerged branch never reaches production. The job uses its own concurrency group (`deploy-production`, `cancel-in-progress: false`) so a deploy is never cancelled halfway.
- **Why:** Merging a PR does not guarantee a working `main`: two PRs that pass separately can fail together. With tags, the author decides when to publish, the full suite runs on the exact commit that will be deployed, and the tag records which version is in production.
- **Alternatives considered:**
  - Deploy on every push to `main`. Rejected by the author: a merge that breaks `main` would reach production.
  - Vercel's GitHub integration with branch protection. Rejected for the same reason: Vercel deploys whatever reaches its production branch without waiting for CI.
  - A long-lived `release` branch. Rejected: with a single developer there is nothing to stabilise in parallel, and the branch has to be kept in sync with `main` (hotfixes merged back).

### D5: Vercel Configuration via `vercel.json` (Git Governance and Function Region)
- **Choice:** Add `vercel.json` with `"git": { "deploymentEnabled": false }` and `"regions": ["fra1"]`.
- **Why:**
  1. Ensures that opening a PR or pushing to GitHub does not trigger an uncontrolled preview or production build on Vercel bypassing GitHub Actions checks. GitHub Actions controls all deployments.
  2. Colocates Vercel Serverless Functions in Frankfurt (`fra1`) with the Neon PostgreSQL database (`eu-central-1`), eliminating ~80–100ms of transatlantic network roundtrip latency per database query.
- **Alternative considered:** Configuring "Ignored Build Step" and function regions in Vercel project dashboard manually. Rejected because repository-as-code (`vercel.json`) ensures the configuration is version-controlled, reproducible, and transparent.

### D6: `package.json` Version as the Visible Version
- **Choice** (decided by the author on 2026-10-11): `"version"` in `package.json` is the only source of the version. A release bumps it in a PR and, once merged, pushes the tag `v<version>`. The `deploy` job fails before building if the tag (`GITHUB_REF_NAME`) is not exactly `v` followed by that version, and tags the Vercel deployment with it as metadata (`vercel deploy … -m version=<tag>`). `next.config.ts` reads the version from `package.json` and inlines it at build time through its `env` option. Only server code reads it: the layouts that mount the shell pass it to `AccountMenu` as a prop, next to the email, and the panel shows "Versión v<version>". `next.config.ts` also sets `poweredByHeader: false`.
- **Why:** The author needs to confirm, after a release, that the pages served come from that version, and to see the version in the code. With `package.json` as the source and the tag checked against it, the field, the tag, the menu and the Vercel metadata never disagree. Sentry will tag errors with the same value as `release` when MF-32 adds it. Reading the value only on the server keeps it out of the public JavaScript bundles: `AccountMenu` is a client component, and a value read there would be inlined into a chunk anyone can download.
- **Verification note:** a tab opened before a deploy keeps the old client code until it is reloaded; the version in the menu is always the one the server rendered, so the check is made after reloading.
- **Alternatives considered:**
  - The tag as the only source, passed to the build as an environment variable. Rejected: `package.json` `version` would stay at `0.1.0` while the tags move on, a field that misleads whoever reads it.
  - An `X-App-Version` header on every response. Rejected: anyone, without an account, would see which commit of the public repository is deployed, and checking it needs DevTools or `curl`.

## Risks / Trade-offs

- **[Risk: CSP breaks Next.js client-side navigation or inline styles]** → Mitigation: Tested via local build, Vitest unit tests on `next.config.ts`, on `withContentSecurityPolicy` and on the proxy matcher, and the Playwright E2E suite, which runs against `pnpm build && pnpm start`, before pushing.
- **[Risk: `src/proxy.ts` is not classified in ADR-001]** → Mitigation: check that the `eslint-plugin-boundaries` rules accept it as part of the web adapter before writing it; if they do not, propose its classification to the author instead of silencing the rule.
- **[Risk: the CSP blocks Sentry]** → `default-src 'self'` will block the browser from sending events to Sentry when MF-32 adds it. MF-32 will need a `connect-src` entry for Sentry or a tunnel route.
- **[Risk: Vercel CLI requires credentials during build step]** → Mitigation: `vercel pull` fetches project settings using repo secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`. The `deploy` job runs with `permissions: contents: read` only.
