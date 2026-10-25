## Context

Checked in the installed `@genkit-ai/core` 1.42.0:

- `lib/tracing.js`: `ensureBasicTelemetryInstrumentation()` runs on every action. It first calls `checkFirebaseMonitoringAutoInit()`, which loads `@genkit-ai/firebase` and calls `enableFirebaseTelemetry()` when `ENABLE_FIREBASE_MONITORING === "true"`. Then, if no telemetry was set up yet, it calls `enableTelemetry({})`.
- `enableTelemetry` returns early when `global.__GENKIT_DISABLE_GENKIT_OTEL_INITIALIZATION === true`, which `disableGenkitOTelInitialization()` sets. Otherwise it sets `global.__GENKIT_TELEMETRY_INSTRUMENTED` and starts a `NodeSDK` (`lib/tracing/node-telemetry-provider.js`) with a `TraceServerExporter`: a `SimpleSpanProcessor` in dev, a `BatchSpanProcessor` elsewhere.
- `enableFirebaseTelemetry()` calls `enableGoogleCloudTelemetry()` (`@genkit-ai/google-cloud/lib/index.js:50`), which also ends in Genkit's `enableTelemetry`, so the flag stops the `NodeSDK` on that path too. Its argument is a promise built before that call: it reads GCP credentials from the environment and, once it resolves, replaces Genkit's logger with a Google Cloud Logging one. Loading the plugin also requires `@opentelemetry/auto-instrumentations-node` (`gcpOpenTelemetry.js:31`).
- `genkit/tracing` exports `disableGenkitOTelInitialization`. Its doc comment marks it `@hidden` and "unstable", the same on `main` of the Genkit repository.
- `genkit` 1.42.0 depends on `@genkit-ai/core` and `@genkit-ai/ai` at exactly `1.42.0`, so the exact version in `package.json` fixes the whole chain.
- In `@genkit-ai/core` `1.43.0-rc.1`, downloaded from npm, `ensureBasicTelemetryInstrumentation` no longer calls `enableTelemetry({})` (PR #6336). Its `@opentelemetry/*` versions are the same as in 1.42.
- `lib/action.js` puts the input and the JSON output of each action in its span metadata.

Next.js 16 (`next/dist/server/lib/trace/tracer.js`, `withPropagatedContext`) returns without extracting headers while OpenTelemetry is not enabled; once a provider is registered it calls `propagation.extract` on the incoming headers.

Both factories live in `src/infrastructure/genkit/` and are called from `src/composition/cli-container.ts`. The web container does not use Genkit yet (MF-22).

## Goals / Non-Goals

**Goals:**
- No OpenTelemetry SDK starts from Genkit outside `GENKIT_ENV=dev`.
- Every Genkit factory goes through the same rule, so a third adapter cannot forget it silently.
- `osv-scanner.toml` and OPS-observabilidad say what is true after the change.

**Non-Goals:**
- Sentry, its SDK or its tracing (MF-40.5).
- Removing the `@opentelemetry/*` packages: `genkit` depends on them.
- Any change to what the decomposer or the embeddings return.

## Decisions

**D1. One helper, called by each factory.** `src/infrastructure/genkit/genkit-telemetry.ts` exports `configureGenkitTelemetry(genkitEnv = process.env.GENKIT_ENV)`: it calls `disableGenkitOTelInitialization()` unless `genkitEnv === 'dev'`. Each factory calls it on its first line, before `genkit(...)`. It is Genkit configuration, so it stays in `infrastructure/genkit/`; no port, because there is no new external boundary (ADR-001). Alternative: one call at the entry points (`cli/index.ts`, and later the web). Rejected: the rule would depend on every entry point remembering it, and a test that builds a factory would not cover it.

**D2. `GENKIT_ENV === 'dev'` and nothing else.** It is what `genkit start` sets and what Genkit's own `isDevEnv()` reads. Any other value, or none, means production. Alternative: `NODE_ENV`. Rejected: `next dev` and Vitest set it to `development` or `test` without the Developer UI running, and the Developer UI is the only consumer of the traces.

**D3. Tests on the public function, never on Genkit's globals.** The tests replace `genkit/tracing` with `vi.mock`, as `src/app/_auth/actions.test.ts` does with `next/cache`, and check whether `disableGenkitOTelInitialization` was called: by the helper for each value of `GENKIT_ENV`, and by each factory with `GENKIT_ENV` unset. They do not check that the `NodeSDK` stays off: that would need Genkit's globals or `@opentelemetry/api` as a new dependency, and the author does not want tests on Genkit internals (2026-10-12). That the function keeps the SDK off was read in the installed code (Context) and is checked once by hand (tasks).

**D6. The 1.42.0 pin is guarded by a test.** A test reads `package.json` and expects `genkit` and `@genkit-ai/google-genai` at exactly `1.42.0`. Its failure message names MF-40.4 and says that 1.43 no longer starts the SDK, so the call may be dropped. Dependabot groups minor updates and would open the 1.43 pull request; this test makes it fail in CI. Alternative: an `ignore` rule in `.github/dependabot.yml`. Rejected: the upgrade would never be proposed, and nobody would notice 1.43.

**D4. `osv-scanner.toml`.** The header and each OpenTelemetry reason are rewritten to say: Genkit starts the `NodeSDK` on its own unless turned off; the project turns it off outside `GENKIT_ENV=dev` (this change); in the web, Next.js extracts the `baggage` header only while a provider is registered, so GHSA-8988-4f7v-96qf is not reached in production; `ENABLE_FIREBASE_MONITORING` must stay unset: the disable flag still stops the `NodeSDK` on that path, but the variable loads the Google Cloud plugin, its instrumentations package and its logger. The entries stay ignored; none is fixed by this change.

**D5. OPS-observabilidad.** The sentence about Genkit traces exported to Sentry by OTLP, and its "por verificar en el descomponedor (MF-40)", are replaced by: the Genkit traces exist only in local dev, in the Developer UI under `genkit start`; in production Genkit starts no OpenTelemetry (MF-40.4). The rest of the entry stays.

## Risks / Trade-offs

- **`ENABLE_FIREBASE_MONITORING=true` has side effects the flag does not stop.** The flag still keeps the `NodeSDK` off, because `enableFirebaseTelemetry` ends in the guarded `enableTelemetry`. But before that, the Google Cloud plugin loads, looks for GCP credentials and, if its configuration resolves, sends Genkit's logs to Google Cloud Logging. → Not set anywhere today: a task checks the Vercel variables (`context/runbooks/despliegue.md` lists five, none of them this one), and `osv-scanner.toml` says it must stay unset.
- **A hidden, "unstable" function.** It could change in any release. → D6: the version is pinned and an upgrade fails the tests; the 1.42.0 code is fixed while the pin holds.
- **No automated test that the SDK stays off.** → D3; checked by hand once, and again whenever the pin moves.
- **No production traces of the LLM flows.** Latency per call is then measured by the evaluations (`evals/decomposer/results.md`), not in production. → Accepted by the author with "no se puede activar OpenTelemetry en Genkit" (2026-10-12). Whether the request latency should reach Sentry is for MF-40.5, which today covers errors only.
- **MF-40.5 registers its own provider.** In the published `@sentry/node` 11.6.0, `Sentry.init()` registers a `SentryTracerProvider` and a `SentryPropagator` (`build/cjs/sdk/initOtel.js`), and the package depends on `@opentelemetry/api` only, not on `@opentelemetry/core`. Next.js will then extract headers again, through Sentry's code. If Genkit's `NodeSDK` were registered first, Sentry could not register its own (`initOtel.js`, "another OpenTelemetry tracer provider is already registered"), so this change also clears the way for MF-40.5. → Whether Sentry also records traces is decided in MF-40.5; it runs `osv-scanner` on what it installs.
