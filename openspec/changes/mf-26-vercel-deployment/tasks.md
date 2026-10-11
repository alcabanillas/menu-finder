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

## 2. Visible Version

- [x] 2.1 Write failing tests: `next.config.test.ts` checks `poweredByHeader: false` and that `env.APP_VERSION` is the `version` of `package.json`; `account-menu.test.tsx` checks that the panel shows "Versión v<version>" from a prop (RED)
- [x] 2.2 Implement them in `next.config.ts` and `AccountMenu`, and pass the version from the server layouts that mount the shell (`src/app/(signed-in)/layout.tsx`, `src/app/page.tsx`), and verify the tests pass (GREEN)
- [x] 2.3 Add an E2E test that requests `/` and `/login` without a session and checks the real responses: the four fixed headers, a `Content-Security-Policy` whose `script-src` has a nonce and `'strict-dynamic'` and no `'unsafe-inline'`, a different nonce on a second request, no `X-Powered-By`, and no version in the body; and that no file under `.next/static` contains the version (`specs/security-headers`, `specs/app-shell`, `context/safety-first.md §2.4`)

## 3. Vercel Git Build Governance

- [x] 3.1 Create `vercel.json` disabling direct Git deployments (`git.deploymentEnabled: false`) and verify valid JSON syntax

## 4. GitHub Actions Deployment Pipeline

- [x] 4.1 Add `vercel` as an exact-version devDependency: check that the package on npm is the official Vercel CLI and pick a version published at least 7 days ago (`context/safety-first.md §2.5`, `OPS-ci-cd`)
- [x] 4.2 Add `tags: ['v*']` to the `push` trigger of `.github/workflows/ci.yml` and a `deploy` job that runs only on version tags (`if: startsWith(github.ref, 'refs/tags/v')`), with `needs: [checks, e2e]`, `permissions: contents: read`, its own concurrency group (`deploy-production`, `cancel-in-progress: false`), the same checkout (with `fetch-depth: 0`, needed to compare the tag with `main`), pnpm and Node setup as the other jobs, `pnpm install --frozen-lockfile`, a check that the tagged commit is in `main` (`git merge-base --is-ancestor`), and the three `pnpm exec vercel` steps (`design.md` D3, D4)
- [x] 4.3 Add a step to the `deploy` job, before `vercel pull`, that fails unless `GITHUB_REF_NAME` equals `v` followed by the `version` of `package.json`, and add `-m version=${{ github.ref_name }}` to `vercel deploy` (`design.md` D6)
- [x] 4.4 Run local lint, typecheck, tests with coverage and the E2E suite (which builds and starts the app with the nonce-based CSP) to verify the complete suite passes before pushing
- [ ] 4.5 After merging into `main`, create and push the first release tag (`git tag v0.1.0` and `git push origin v0.1.0`; `package.json` already says `0.1.0`), confirm the `deploy` job succeeds, and check that `https://menu-finder-mbs.vercel.app` responds with the security headers and, after signing in and reloading, the account menu shows "Versión v0.1.0"
- [x] 4.6 Go through the checklist in `context/safety-first.md §4` before `archive`
