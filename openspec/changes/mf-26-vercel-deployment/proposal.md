## Why

Roadmap item **MF-26**. The application needs an automated, secure production deployment to Vercel that enforces the pipeline principle: **test → build → deploy** (OPS-ci-cd, OPS-vercel). Today, commits and PRs can trigger unverified Vercel deployments directly, and the web server does not yet serve mandatory HTTP security headers specified in `context/safety-first.md §2.4`.

With the human setup completed (Vercel project `menu-finder-mbs` connected to the repository, production environment variables configured), deployments must wait for the CI checks, happen only when the author decides, and serve strict HTTP security headers.

**Result:** Moving the `production` branch to a tagged commit of `main` (for example `v0.1.0`) runs lint, typecheck, unit/integration tests with coverage, E2E tests and the release check on that commit, and Vercel promotes it to production only if all pass. Merging a PR into `main` does not deploy. After reloading, the account menu shows the tag the running version was built from. The application serves strict HTTP security headers on all responses, and a nonce-based Content-Security-Policy on every page.

## What Changes

- **HTTP Security Headers** (`design.md` D1, D2):
  - `Content-Security-Policy` (CSP) on every page, set by `src/proxy.ts` with a fresh nonce per request: `default-src 'self'` and `script-src 'self' 'nonce-<value>' 'strict-dynamic'`, without `'unsafe-inline'` for scripts.
  - On every route, declared in `next.config.ts`:
    - `X-Content-Type-Options: nosniff`.
    - `X-Frame-Options: DENY` (on pages, the CSP adds `frame-ancestors 'none'`).
    - `Referrer-Policy: strict-origin-when-cross-origin`.
    - `Permissions-Policy` disabling unused browser APIs (camera, microphone, geolocation).
- **Deployment from the `production` branch** (`design.md` D3, D4): Vercel for GitHub builds the Production Branch, `production`, and Deployment Checks hold each deployment until the jobs `checks`, `e2e` and `release` pass on its commit. `ci.yml` also runs on pushes to `production`, and its new `release` job checks that the commit is in `main` and carries the tag `v<version>`. No Vercel CLI and no Vercel token in GitHub.
- **Visible version** (`design.md` D6): `"version"` in `package.json` is the source. The `release` job fails if the commit's tag is not `v<version>`. The account menu shows "Versión v<version>" only to signed-in users. `X-Powered-By` is turned off.
- **Vercel Git Build Governance** (`design.md` D5): `vercel.json` lets only `production` deploy (`git.deploymentEnabled`), and runs the functions in `fra1`, next to the database.

## Capabilities

### New Capabilities
- `security-headers`: Enforces strict HTTP security headers on all responses served by the application, and a nonce-based Content-Security-Policy on its pages.

### Modified Capabilities
- `app-shell`: the account menu also shows the deployed version.

## Impact

- **Code:** `next.config.ts`, `src/proxy.ts` (new), `AccountMenu` and the layouts that mount the shell, `.github/workflows/ci.yml`, `vercel.json`, and automated tests for the headers in `next.config.ts` for the CSP and the proxy matcher, and an E2E test on real responses.
- **Systems:** Vercel deploys only the `production` branch, and only after the CI checks pass on its commit. The Production Branch and the Deployment Checks are set in the Vercel dashboard. The `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` repository secrets are no longer needed. No other branch deploys, so there are no preview deployments, so the rule of `context/safety-first.md §2.4` that previews be access-protected and use their own Neon branch is met by omission.
- **Decisions relied on:** `OPS-vercel` (deployment on Vercel), `OPS-ci-cd` (test → build → deploy pipeline in GitHub Actions with minimal permissions), `context/safety-first.md §2.4` (platform and deployment requirements).
- **Data:** No domain data or nutritionist data is touched (SEG-datos-nutricionista).
- **Abuses and OWASP** (Top 10:2025, `context/OWASP-Top10.md`):
  - *A02:2025 - Security Misconfiguration:* Missing HTTP response headers leave users exposed to MIME sniffing, framing/clickjacking and cross-origin resource loading. Mitigated by a restrictive CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`.
  - *A05:2025 - Injection:* Cross-site scripting through injected scripts. The nonce-based CSP runs only the scripts that carry the nonce of the current request, so it blocks injected inline scripts and scripts from other origins (`design.md` D2). Injected inline styles still pass (`style-src 'unsafe-inline'`, residual risk); React's output escaping remains the first barrier.
  - *A03:2025 - Software Supply Chain Failures:* A deployment tool in CI would add its dependency tree to the job that holds the deployment token; the Vercel CLI brought about 35 advisories. Avoided: there is no CLI and no token in CI, and Vercel builds with the project's own lockfile (`design.md` D3).
  - *A06:2025 - Insecure Design:* Deploying code that fails unit, integration or E2E tests. Mitigated by Deployment Checks, which hold every production deployment until `checks`, `e2e` and `release` pass.
  - *A08:2025 - Software or Data Integrity Failures:* Deployments that bypass the pipeline, or a commit pushed straight to `production`, would let unverified code reach production. Mitigated by deploying only `production` (`vercel.json`), by the `release` job, which fails for a commit that is not in `main`, and by keeping the workflow's `GITHUB_TOKEN` at `contents: read`.

## Open Points

Found in the review of 2026-10-11. All of them are resolved.

### Resolved

- **`BETTER_AUTH_SECRET` overlaps with MF-46.** It was already set in Vercel on 2026-10-11. The first answer, that the build did not need it, was wrong: without the variables Next.js tried to prerender `/`, whose session read builds the web container and throws. A Vercel preview without them failed that way. The root layout now calls `connection()` (`design.md` D2), so no page is prerendered and a build without any variable succeeds (checked in a clean worktree).
- **The case against nonces was weaker than stated.** Every page already renders dynamically, so the author chose a nonce-based CSP in `src/proxy.ts` on 2026-10-11 (`design.md` D2, which also covers hashes and SRI as rejected alternatives).
- **D1 still said "middleware".** D1 is rewritten around `next.config.ts` and `proxy.ts`.
- **CSP and Sentry.** Added to Risks in `design.md`: MF-32 will need a `connect-src` entry for Sentry or a tunnel route.
- **No scenario covered every kind of route.** The spec now states that the fixed headers reach API routes and static assets too, and that the CSP covers pages.
- **Missing closing tasks.** `tasks.md` now has a REFACTOR step (1.9) and the `context/safety-first.md §4` checklist before `archive` (3.5).
- **Headers not checked on real responses.** An E2E test in `e2e/` reads the headers of real responses from `pnpm build && pnpm start` (task 2.3), in addition to the manual check of the deployed URL (task 4.5).
- **Preview deployments resolved by omission.** Stated under Impact.
- **Mixed language.** The Impact heading is now "Decisions relied on".
