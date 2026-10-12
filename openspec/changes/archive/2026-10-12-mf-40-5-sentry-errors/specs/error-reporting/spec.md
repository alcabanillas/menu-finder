## Purpose

Sends the uncaught errors of the Next.js server to Sentry, errors only, with no data from the request that caused them.

## ADDED Requirements

### Requirement: Server errors reach Sentry
In the Node.js runtime of Next.js, the web application SHALL start Sentry with the DSN read from `SENTRY_DSN` before it serves requests, and SHALL report every uncaught request error to Sentry through `Sentry.captureRequestError`. In the edge runtime it SHALL NOT start Sentry.

#### Scenario: Node.js runtime
- **WHEN** `register` runs with `NEXT_RUNTIME` set to `nodejs` and `SENTRY_DSN` set
- **THEN** Sentry is started once, with that DSN

#### Scenario: Edge runtime
- **WHEN** `register` runs with `NEXT_RUNTIME` set to `edge`
- **THEN** Sentry is not started

#### Scenario: Uncaught request error
- **WHEN** Next.js loads the instrumentation file
- **THEN** its `onRequestError` export is `Sentry.captureRequestError`

### Requirement: Errors only
Sentry SHALL be started with neither `tracesSampleRate` nor `tracesSampler`, so that no transaction or span is sent.

#### Scenario: No tracing options
- **WHEN** Sentry is started
- **THEN** its options contain neither `tracesSampleRate` nor `tracesSampler`

### Requirement: No request data in events
Sentry SHALL be started with every `dataCollection` field off, so that no event carries user info, cookies, HTTP headers, HTTP bodies, URL query parameters, GraphQL documents or variables, AI inputs or outputs, database query data, queue data or stack frame variables.

#### Scenario: Every field off
- **WHEN** Sentry is started
- **THEN** `dataCollection` has `userInfo`, `cookies`, `httpHeaders`, `urlQueryParams`, `databaseQueryData`, `queues` and `stackFrameVariables` set to `false`, `httpBodies` set to an empty list, `graphQL.document` and `graphQL.variables` set to `false`, and `genAI.inputs` and `genAI.outputs` set to `false`
