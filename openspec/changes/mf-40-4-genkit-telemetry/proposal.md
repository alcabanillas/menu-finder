## Why

MF-40.4 (`context/roadmap.md`, item MF-40). Genkit 1.42 starts OpenTelemetry on its own the first time an action runs: `ensureBasicTelemetryInstrumentation` calls `enableTelemetry({})`, which starts a `NodeSDK` 0.52 with a span processor for the Genkit telemetry server. The project never asked for it, and it loads the `@opentelemetry/*` versions behind the vulnerabilities accepted in `osv-scanner.toml`, whose reasons say none of them is reachable. That stops being true when the decomposer runs in the web (MF-22): once a global tracer provider is registered, Next.js 16 extracts the `baggage` header of every request with it (`withPropagatedContext` in `next/dist/server/lib/trace/tracer.js`), which is the code of GHSA-8988-4f7v-96qf. The author ruled on 2026-10-12 that OpenTelemetry must not run in Genkit outside local development.

The only switch in 1.42 is `disableGenkitOTelInitialization()`, exported by `genkit/tracing` but marked `@hidden` and "unstable" in its own doc comment. Genkit 1.43 removes the problem at the source: since PR #6336 (merged 2026-10-08, already in `1.43.0-rc.1`), `ensureBasicTelemetryInstrumentation` no longer starts a `NodeSDK`. 1.43 is not stable yet, and the author chose on 2026-10-12 to use the switch on a pinned 1.42.0 now, and to decide again when Genkit is upgraded.

## What Changes

- Genkit does not start OpenTelemetry unless `GENKIT_ENV` is `dev`, the value `genkit start` sets. Outside dev, the adapters call `disableGenkitOTelInitialization()` from `genkit/tracing` before the first action, so `enableTelemetry` returns early and no `NodeSDK` starts.
- Both Genkit factories do it: `createGenkitRequestDecomposer` and `createGenkitEmbeddings`. In dev nothing changes: the Developer UI keeps its traces.
- `genkit` and `@genkit-ai/google-genai` stay at exactly `1.42.0`, as `package.json` already has them. A test fails if either changes, naming MF-40.4, so a Dependabot upgrade to 1.43 cannot land without deciding again.
- The reasons in `osv-scanner.toml` are rewritten with this finding, GHSA-8988-4f7v-96qf included: what loads the vulnerable code, why it is no longer reached in production, and that `ENABLE_FIREBASE_MONITORING` must stay unset.
- OPS-observabilidad in `context/decisiones.md` no longer says that the Genkit traces go to Sentry by OTLP: the traces live only in the local Developer UI, and Sentry receives errors (MF-40.5).

No change to the decomposer's answers, to the embeddings, to the web or to the CLI commands.

## Capabilities

### New Capabilities
- `llm-telemetry`: when Genkit may start OpenTelemetry, for every adapter that creates a Genkit instance.

### Modified Capabilities
None. `request-decomposer` and the embeddings behave the same; only their telemetry changes, and it gets its own capability.

## Impact

- **Code:** a helper in `src/infrastructure/genkit/` and one call to it in `genkit-request-decomposer.ts` and `genkit-embeddings.ts`, with tests; a test on the Genkit versions of `package.json`.
- **Configuration and documentation:** `osv-scanner.toml`; OPS-observabilidad in `context/decisiones.md`.
- **Dependencies:** none added or removed. The `@opentelemetry/*` packages stay installed, because `genkit` depends on them.
- **Decisions it relies on:** OPS-observabilidad (changed here, as the roadmap item says), IA-proveedor, ARQ-hexagonal, SEG-owasp, SEG-datos-nutricionista.
- **Contradiction to flag:** ING-trazabilidad says the Genkit traces cover the three LLM flows. That stays true only in local dev. This change does not edit it; the author decides whether it needs a line.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* none new. Today a span of every Genkit action holds the request text and the model answer, and the `BatchSpanProcessor` would send it to the telemetry server if `GENKIT_TELEMETRY_SERVER` were set. Outside dev no span is recorded, so that text has no path out (SEG-datos-nutricionista).
  - *Abuses:* a request with a huge `baggage` header that makes OpenTelemetry allocate without limit, GHSA-8988-4f7v-96qf (A06 Vulnerable and Outdated Components, LLM10 Unbounded Consumption). Turning on Firebase monitoring by mistake with `ENABLE_FIREBASE_MONITORING=true`: the disable flag still keeps OpenTelemetry off, but the Google Cloud plugin loads and may send Genkit's logs to Google Cloud Logging (A05 Security Misconfiguration).
  - *Not applicable:* authorization (A01) and input validation, because no endpoint or command is added or changed.
