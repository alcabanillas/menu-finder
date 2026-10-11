## 1. HTTP Security Headers

- [x] 1.1 Add `next.config.test.ts` to the `include` list of the `node` project in `vitest.config.ts` (today it only collects `src/`, `evals/`, `scripts/` and `e2e/`, so a root test would never run), and confirm with `pnpm vitest list` that the file is collected
- [x] 1.2 Rewrite `next.config.test.ts` so it asserts only the four fixed headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) on `/:path*`, and that `next.config.ts` no longer sets a `Content-Security-Policy`; verify it fails against the current `next.config.ts` (RED)
- [x] 1.3 Remove the CSP from `next.config.ts`, keeping the four fixed headers, and verify the test passes (GREEN)
- [x] 1.4 Check where `src/proxy.ts` and the CSP builder belong under ADR-001 and whether the `eslint-plugin-boundaries` rules accept them; if they do not, stop and propose the classification to the author (`design.md` Risks)
- [x] 1.5 Write failing unit tests for the CSP builder, a pure function of the nonce and `NODE_ENV`: `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `script-src` with `'nonce-<value>'` and `'strict-dynamic'` and without `'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, and `'unsafe-eval'` only in development (RED)
- [x] 1.6 Implement the CSP builder and verify its tests pass (GREEN)
- [x] 1.7 Write failing unit tests for `src/proxy.ts`: the response and the forwarded request carry the same CSP, two calls produce different nonces, and the exported `matcher` excludes `api`, `_next/static`, `_next/image`, `favicon.ico` and prefetches (RED)
- [x] 1.8 Implement `src/proxy.ts` with a nonce from `crypto.randomUUID()` and the matcher of the Next.js 16 CSP guide, and verify its tests pass (GREEN)
- [x] 1.9 Refactor the header code with the tests green (REFACTOR): the CSP builder and `withContentSecurityPolicy` merged into `src/app/content-security-policy.ts`, with one export and one test file
- [x] 1.10 Force dynamic rendering with `await connection()` in the root layout, test-first, and check that a build without any environment variable succeeds and prerenders no page (`design.md` D2)

## 2. Visible Version

- [x] 2.1 Write failing tests: `next.config.test.ts` checks `poweredByHeader: false` and that `env.APP_VERSION` is the `version` of `package.json`; `account-menu.test.tsx` checks that the panel shows "Versión v<version>" from a prop (RED)
- [x] 2.2 Implement them in `next.config.ts` and `AccountMenu`, and pass the version from the server layouts that mount the shell (`src/app/(signed-in)/layout.tsx`, `src/app/page.tsx`), and verify the tests pass (GREEN)
- [x] 2.3 Add an E2E test that requests `/` and `/login` without a session and checks the real responses: the four fixed headers, a `Content-Security-Policy` whose `script-src` has a nonce and `'strict-dynamic'` and no `'unsafe-inline'`, a different nonce on a second request, no `X-Powered-By`, and no version in the body; and that no file under `.next/static` contains the version (`specs/security-headers`, `specs/app-shell`, `context/safety-first.md §2.4`)

## 3. Vercel Git Build Governance

- [x] 3.1 Set `vercel.json` to `"git": { "deploymentEnabled": { "**": false, "production": true } }`, keeping `"regions": ["fra1"]`, and verify valid JSON syntax (`design.md` D5)

## 4. Deployment Pipeline

- [x] 4.1 Remove the `vercel` devDependency (`pnpm-lock.yaml` back to `main`'s CLI-free tree), the `deploy` job and the `tags: ['v*']` trigger from `.github/workflows/ci.yml` (`design.md` D3)
- [x] 4.2 Add `production` to the `push` branches of `ci.yml` and a `release` job that runs only on pushes to `production`, with `permissions: contents: read` and a full checkout (`fetch-depth: 0`), and fails unless the commit is in `origin/main` (`git merge-base --is-ancestor`) and the tag `v<version of package.json>` points to it; dry-run its script locally with a matching and a mismatching tag (`design.md` D4)
- [x] 4.3 Run local lint, typecheck, tests with coverage and the E2E suite to verify the complete suite passes before pushing, and check that OSV-Scanner passes on the PR
- [ ] 4.4 In the Vercel dashboard (author): Production Branch `production`; Node.js 24; Deployment Checks on `checks`, `e2e` and `release`; automatic assignment of the production domain on. Remove the `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` repository secrets
- [ ] 4.5 After merging into `main`: `git tag v0.1.0`, `git push origin v0.1.0` and `git push origin v0.1.0:production`; confirm in Vercel that the deployment waits for the three checks and is then promoted, and that `https://menu-finder-mbs.vercel.app` responds with the security headers and, once signed in (after MF-46) and reloaded, the account menu shows "Versión v0.1.0"
- [ ] 4.7 Move the `release` job to its own workflow, `.github/workflows/release.yml`, on pushes to `production` only, and take `production` out of the `push` branches of `ci.yml`, so each Deployment Check has one run per commit; write the deployment runbook in `context/despliegue.md`; confirm on the next release that the deployment waits for `release` (`design.md` D4)
- [ ] 4.6 Go through the checklist in `context/safety-first.md §4` again before `archive`
