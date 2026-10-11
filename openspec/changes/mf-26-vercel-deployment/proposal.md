## Why

Roadmap item **MF-26**. The application needs an automated, secure production deployment to Vercel that enforces the pipeline principle: **test → build → deploy** (OPS-ci-cd, OPS-vercel). Today, commits and PRs can trigger unverified Vercel deployments directly, and the web server does not yet serve mandatory HTTP security headers specified in `context/safety-first.md §2.4`.

With the human setup completed (Vercel project linked at `menu-finder-mbs`, production environment variables configured, and `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` registered as GitHub repository secrets), we must automate deployment from GitHub Actions while enforcing strict HTTP security headers and disabling untrusted automatic Git builds on Vercel.

**Result:** Pushing a version tag (for example `v0.1.0`) runs lint, typecheck, unit/integration tests with coverage, and E2E tests on that commit and, only if all pass, deploys it to Vercel production. Merging a PR into `main` does not deploy. After reloading, the account menu shows the tag the running version was built from. The application serves strict HTTP security headers on all responses, and a nonce-based Content-Security-Policy on every page.

## What Changes

- **HTTP Security Headers** (`design.md` D1, D2):
  - `Content-Security-Policy` (CSP) on every page, set by `src/proxy.ts` with a fresh nonce per request: `default-src 'self'` and `script-src 'self' 'nonce-<value>' 'strict-dynamic'`, without `'unsafe-inline'` for scripts.
  - On every route, declared in `next.config.ts`:
    - `X-Content-Type-Options: nosniff`.
    - `X-Frame-Options: DENY` (on pages, the CSP adds `frame-ancestors 'none'`).
    - `Referrer-Policy: strict-origin-when-cross-origin`.
    - `Permissions-Policy` disabling unused browser APIs (camera, microphone, geolocation).
- **GitHub Actions Deployment Pipeline:** Add a `deploy` job to `.github/workflows/ci.yml`:
  - Runs **only** when a version tag (`v*`) is pushed, and only if the tagged commit is already in `main` (`design.md` D4).
  - Requires all test jobs to pass first on the tagged commit (`needs: [checks, e2e]`).
  - Uses project-scoped Vercel credentials (`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`).
  - Runs the Vercel CLI pinned as a devDependency in the lockfile (`design.md` D3): pulls production environment configuration (`vercel pull --yes --environment=production`), builds the precompiled bundle (`vercel build --prod`), and deploys (`vercel deploy --prebuilt --prod`).
  - Restricted to minimal permissions (`permissions: contents: read`).
- **Visible version** (`design.md` D6): `"version"` in `package.json` is the source. The `deploy` job fails if the tag is not `v<version>`, and tags the Vercel deployment with it. The account menu shows "Versión v<version>" only to signed-in users. `X-Powered-By` is turned off.
- **Vercel Git Build Governance:** Add a `vercel.json` (or ignore command) so Vercel does not auto-build branches on Git push independently of GitHub Actions.

## Capabilities

### New Capabilities
- `security-headers`: Enforces strict HTTP security headers on all responses served by the application, and a nonce-based Content-Security-Policy on its pages.

### Modified Capabilities
- `app-shell`: the account menu also shows the deployed version.

## Impact

- **Code:** `next.config.ts`, `src/proxy.ts` (new), `AccountMenu` and the layouts that mount the shell, `.github/workflows/ci.yml`, `vercel.json`, and automated tests for the headers in `next.config.ts` for the CSP and the proxy matcher, and an E2E test on real responses.
- **Systems:** Vercel production deployment is governed exclusively by GitHub Actions; automatic builds directly triggered by GitHub webhooks are suppressed. With `git.deploymentEnabled: false` there are no preview deployments, so the rule of `context/safety-first.md §2.4` that previews be access-protected and use their own Neon branch is met by omission.
- **Decisions relied on:** `OPS-vercel` (deployment on Vercel), `OPS-ci-cd` (test → build → deploy pipeline in GitHub Actions with minimal permissions), `context/safety-first.md §2.4` (platform and deployment requirements).
- **Data:** No domain data or nutritionist data is touched (SEG-datos-nutricionista).
- **Abuses and OWASP** (Top 10:2025, `context/OWASP-Top10.md`):
  - *A02:2025 - Security Misconfiguration:* Missing HTTP response headers leave users exposed to MIME sniffing, framing/clickjacking and cross-origin resource loading. Mitigated by a restrictive CSP, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`.
  - *A05:2025 - Injection:* Cross-site scripting through injected scripts. The nonce-based CSP runs only the scripts that carry the nonce of the current request, so it blocks injected inline scripts and scripts from other origins (`design.md` D2). Injected inline styles still pass (`style-src 'unsafe-inline'`, residual risk); React's output escaping remains the first barrier.
  - *A03:2025 - Software Supply Chain Failures:* The deploy job runs the Vercel CLI with access to the deployment token; a compromised or unexpected CLI version could leak it or alter the build. Mitigated by pinning the CLI as a devDependency in the lockfile, so it is installed with `--frozen-lockfile` and watched by Dependabot (7-day cooldown) and OSV-Scanner (`design.md` D3).
  - *A06:2025 - Insecure Design:* Deploying code that fails unit, integration or E2E tests. Mitigated by gating the `deploy` job behind `checks` and `e2e` passing completely.
  - *A08:2025 - Software or Data Integrity Failures:* Deployments that bypass the pipeline (Vercel Git builds) or leaked deployment credentials let unverified code reach production. Mitigated by disabling Vercel Git deployments (`vercel.json`), keeping the Vercel token as a project-scoped repository secret and restricting the workflow's `GITHUB_TOKEN` to `contents: read`.

## Open Points

Found in the review of 2026-10-11. All of them are resolved.

### Resolved

- **`BETTER_AUTH_SECRET` overlaps with MF-46.** The build does not need it. `createWebContainer` (`src/composition/web-container.ts`) reads its variables on the first call, never at import or build time, so `vercel build` succeeds without the secret. Setting it in Vercel stays with MF-46; until then, signing in on the deployment fails at request time.
- **Vercel token passed as a command-line argument.** The CLI reads `VERCEL_TOKEN` from the environment when `--token` is absent, so the job passes it through `env:` (`design.md` D3).
- **The case against nonces was weaker than stated.** Every page already renders dynamically, so the author chose a nonce-based CSP in `src/proxy.ts` on 2026-10-11 (`design.md` D2, which also covers hashes and SRI as rejected alternatives).
- **D1 still said "middleware".** D1 is rewritten around `next.config.ts` and `proxy.ts`.
- **CSP and Sentry.** Added to Risks in `design.md`: MF-32 will need a `connect-src` entry for Sentry or a tunnel route.
- **No scenario covered every kind of route.** The spec now states that the fixed headers reach API routes and static assets too, and that the CSP covers pages.
- **Missing closing tasks.** `tasks.md` now has a REFACTOR step (1.9) and the `context/safety-first.md §4` checklist before `archive` (3.5).
- **Headers not checked on real responses.** An E2E test in `e2e/` reads the headers of real responses from `pnpm build && pnpm start` (task 2.3), in addition to the manual check of the deployed URL (task 4.5).
- **Preview deployments resolved by omission.** Stated under Impact.
- **Mixed language.** The Impact heading is now "Decisions relied on".
