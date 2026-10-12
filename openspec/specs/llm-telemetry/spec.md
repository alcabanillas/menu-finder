# llm-telemetry Specification

## Purpose
Keeps OpenTelemetry off in every Genkit instance the project creates, except in local development under `genkit start`, so that no tracer provider, span or exporter runs in production.

## Requirements

### Requirement: OpenTelemetry only in development
Every factory that creates a Genkit instance (the decomposer and the embeddings) SHALL call `disableGenkitOTelInitialization()` from `genkit/tracing` before the instance runs its first action, unless the environment variable `GENKIT_ENV` is exactly `dev`. With `GENKIT_ENV` set to `dev`, the factories SHALL NOT call it, so the Developer UI receives its traces.

#### Scenario: Not set
- **WHEN** `GENKIT_ENV` is not set and a factory creates its instance
- **THEN** `disableGenkitOTelInitialization` is called

#### Scenario: Any value other than dev
- **WHEN** `GENKIT_ENV` is `prod` and a factory creates its instance
- **THEN** `disableGenkitOTelInitialization` is called

#### Scenario: Development
- **WHEN** `GENKIT_ENV` is `dev` and a factory creates its instance
- **THEN** `disableGenkitOTelInitialization` is not called

#### Scenario: Decomposer factory
- **WHEN** `GENKIT_ENV` is not set and `createGenkitRequestDecomposer` creates its instance
- **THEN** `disableGenkitOTelInitialization` is called

#### Scenario: Embeddings factory
- **WHEN** `GENKIT_ENV` is not set and `createGenkitEmbeddings` creates its instance
- **THEN** `disableGenkitOTelInitialization` is called

### Requirement: Genkit version pinned
While the project relies on `disableGenkitOTelInitialization`, `package.json` SHALL depend on `genkit` and `@genkit-ai/google-genai` at exactly `1.42.0`. Any other version SHALL fail the tests with a message that names MF-40.4.

#### Scenario: Pinned versions
- **WHEN** `package.json` has `genkit` and `@genkit-ai/google-genai` at `1.42.0`
- **THEN** the version test passes

#### Scenario: Upgrade
- **WHEN** `package.json` has `genkit` at `1.43.0`
- **THEN** the version test fails, and its message names MF-40.4
