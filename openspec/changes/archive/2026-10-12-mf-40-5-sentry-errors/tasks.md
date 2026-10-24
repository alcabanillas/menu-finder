## 1. Server errors (TDD)

- [x] 1.1 Test `register` and `onRequestError` in `src/instrumentation.test.ts` with `@sentry/nextjs` replaced by `vi.mock` (design D3): scenarios "Node.js runtime", "Edge runtime", "Uncaught request error", "No tracing options" and "Every field off". See them fail
- [x] 1.2 Implement `src/instrumentation.ts` (design D1, D2), with `@sentry/nextjs` `11.6.0` exact in `package.json`

## 2. Architecture

- [x] 2.1 Add `src/instrumentation.ts` to the `web-entry` category in `eslint.config.mjs`, and list it in ADR-001 §2 with an amendment line (design D1)

## 3. Configuration and documentation

- [x] 3.1 Keep `.vercelignore` (design D4)
- [x] 3.2 Update OPS-observabilidad in `context/decisiones.md` (design D5)

## 4. Verification

- [x] 4.1 A forced server error reaches Sentry from Vercel without user data (done in the prototype on 2026-10-12: `MENU-FINDER-2`)
- [x] 4.2 Run the pre-commit checks: vitest, eslint, knip, tsc; `osv-scanner` runs in CI on the pull request
- [x] 4.3 Review `context/seguridad/safety-first.md` §4 before archive
