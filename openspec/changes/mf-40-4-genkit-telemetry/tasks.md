## 1. Telemetry rule (TDD)

- [x] 1.1 Test `configureGenkitTelemetry` with `genkit/tracing` replaced by `vi.mock` (design D3): with `GENKIT_ENV` unset and with `prod`, `disableGenkitOTelInitialization` is called; with `dev`, it is not (scenarios "Not set", "Any value other than dev" and "Development"). See it fail
- [x] 1.2 Implement `src/infrastructure/genkit/genkit-telemetry.ts` (design D1, D2)

## 2. Factories (TDD)

- [x] 2.1 Test that `createGenkitRequestDecomposer('key')` with `GENKIT_ENV` unset calls `disableGenkitOTelInitialization` (scenario "Decomposer factory"). See it fail
- [x] 2.2 Call `configureGenkitTelemetry()` on the first line of `createGenkitRequestDecomposer`
- [x] 2.3 Test that `createGenkitEmbeddings('key')` with `GENKIT_ENV` unset calls `disableGenkitOTelInitialization` (scenario "Embeddings factory"). See it fail
- [x] 2.4 Call `configureGenkitTelemetry()` on the first line of `createGenkitEmbeddings`
- [x] 2.5 Check that no other `genkit(` call exists in `src/` outside these two factories

## 3. Version pin (TDD)

- [x] 3.1 Test that reads `package.json` and expects `genkit` and `@genkit-ai/google-genai` at exactly `1.42.0`, with a failure message that names MF-40.4 and the 1.43 change (design D6). See it fail with the version changed locally to `1.43.0` (scenario "Upgrade"), then pass with `1.42.0` (scenario "Pinned versions"); `package.json` is restored

## 4. Dependencies and documentation

- [ ] 4.1 Rewrite the header and the OpenTelemetry reasons of `osv-scanner.toml` (design D4), and run `osv-scanner` to confirm the same entries are still the only ones ignored
- [x] 4.2 Ask the author to confirm that `ENABLE_FIREBASE_MONITORING` and `GENKIT_ENV` are not set in Vercel (Settings → Environment Variables); it is outside the repository
- [x] 4.3 Update OPS-observabilidad in `context/decisiones.md` (design D5)
- [x] 4.4 Flag to the author the ING-trazabilidad line on Genkit traces (proposal, Impact); edit it only if the author asks

## 5. Verification

- [x] 5.1 By hand, once: with `GENKIT_ENV` unset, run one decomposition from a script and check that no `NodeSDK` started (design D3). Checked on 2026-10-12 with a temporary route in the Next.js server instead of a script: no `NodeSDK` started and Sentry kept the global provider
- [x] 5.2 Run `genkit start` with the decomposer and check that the Developer UI still shows its trace (scenario "Development", by hand)
- [ ] 5.3 Run the pre-commit checks: vitest, eslint, knip, tsc
- [x] 5.4 Review `context/safety-first.md` §4 before archive
