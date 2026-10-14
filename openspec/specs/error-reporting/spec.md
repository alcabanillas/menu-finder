# error-reporting Specification

## Purpose
Sends the uncaught errors of the Next.js server to Sentry, errors only, with no data from the request that caused them.

## Requirements

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

### Requirement: Browser errors reach Sentry
The web application SHALL start Sentry in the browser, before the application becomes interactive, with the value of `SENTRY_DSN` inlined into the browser bundle at build time, so that uncaught exceptions and unhandled promise rejections in the browser are reported. The server, the CSP and the browser SHALL read the DSN from that one variable. As on the server, Sentry SHALL be started with neither `tracesSampleRate` nor `tracesSampler`, with no Session Replay, and with every `dataCollection` field off. Without a DSN, the SDK sends nothing.

#### Scenario: DSN available to the browser
- **WHEN** the Next.js configuration is built with `SENTRY_DSN` set
- **THEN** its `env` exposes that value as `SENTRY_DSN` to the browser bundle

#### Scenario: Browser Sentry started with the DSN
- **WHEN** the client instrumentation file is loaded with `SENTRY_DSN` set
- **THEN** Sentry is started once, with that DSN

#### Scenario: Errors only in the browser
- **WHEN** Sentry is started in the browser
- **THEN** its options contain neither `tracesSampleRate`, `tracesSampler`, `replaysSessionSampleRate` nor `replaysOnErrorSampleRate`, and its integrations include no replay integration

#### Scenario: No request data from the browser
- **WHEN** Sentry is started in the browser
- **THEN** its `dataCollection` is the same as the server's, with every field off

#### Scenario: Same data rules on both sides
- **WHEN** the server and the browser start Sentry
- **THEN** both take `dataCollection` from one shared definition, so a change to it applies to both

### Requirement: Readable stack traces without serving source maps
A production build with `SENTRY_AUTH_TOKEN` set SHALL upload the browser source maps to Sentry and delete them from the build output, so that the stack traces of browser errors point to the original source files and no source map is served. A build without `SENTRY_AUTH_TOKEN` SHALL generate no source maps.

#### Scenario: Build configuration with a token
- **WHEN** the Next.js configuration is built with `SENTRY_AUTH_TOKEN` set
- **THEN** source maps are uploaded and deleted after the upload

#### Scenario: Build configuration without a token
- **WHEN** the Next.js configuration is built without `SENTRY_AUTH_TOKEN`
- **THEN** source maps are disabled, and nothing is uploaded

#### Scenario: Upload errors visible in the build log
- **WHEN** the Next.js configuration is built for Sentry
- **THEN** the Sentry build logs are not silenced, so a failed source-map upload shows its error in the build output

#### Scenario: No source map served
- **WHEN** the production build is served and the browser requests any script under `/_next/static`
- **THEN** no `.map` file exists in the public build output and no script references one with `sourceMappingURL`

#### Scenario: Security headers kept
- **WHEN** the Next.js configuration is wrapped for Sentry
- **THEN** it still sends the fixed security headers and no `X-Powered-By`

### Requirement: Search failures reach Sentry
A web search from the text of a request SHALL report to Sentry, explicitly, every outcome that is a failure of the system: `decomposer-failed`, `embedding-failed`, `search-failed`, `index-not-loaded` and `llm-limit-reached`. These outcomes are returned as values, not thrown, so no uncaught-error handler sees them. Each event SHALL carry the kind of the failure and, for `decomposer-failed` and `embedding-failed`, the model that failed. It SHALL also carry the reason, if the failure has one, with the API key and the text of the request removed. An event SHALL NOT carry the text of the request, the structure of constraints or any of its terms. Outcomes that answer the user's request are not failures of the system and SHALL NOT be reported: a rejection, a request that is too short or too long, an invalid answer of the model, an invalid structure and a request with nothing to search. The search SHALL return the same outcome whether or not it was reported.

#### Scenario: Decomposer failure reported
- **WHEN** a web search ends in `decomposer-failed`
- **THEN** one event reaches Sentry with the kind `decomposer-failed`, the decomposer model and the reason

#### Scenario: Embedding failure reported
- **WHEN** a web search ends in `embedding-failed`
- **THEN** one event reaches Sentry with the kind `embedding-failed`, the embedding model and the reason

#### Scenario: Database failure reported
- **WHEN** a web search ends in `search-failed`
- **THEN** one event reaches Sentry with the kind `search-failed` and the reason

#### Scenario: Index not loaded reported
- **WHEN** a web search ends in `index-not-loaded`
- **THEN** one event reaches Sentry with the kind `index-not-loaded`

#### Scenario: Daily limit reported
- **WHEN** a web search ends in `llm-limit-reached`
- **THEN** one event reaches Sentry with the kind `llm-limit-reached`

#### Scenario: Key and request removed from the reason
- **WHEN** a failure reason contains the API key and the text of the request
- **THEN** the event's reason contains neither, and no field of the event contains the request text

#### Scenario: User outcomes not reported
- **WHEN** a web search ends in a rejection, `request-too-short`, `request-too-long`, `invalid-answer`, `invalid-request` or `nothing-to-search`
- **THEN** no event reaches Sentry

#### Scenario: Successful search not reported
- **WHEN** a web search returns a ranking
- **THEN** no event reaches Sentry
