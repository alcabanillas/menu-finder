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

### Requirement: No server tracing
The Node.js server SHALL start Sentry with neither `tracesSampleRate` nor `tracesSampler`, so that no server transaction or span is sent.

#### Scenario: No tracing options
- **WHEN** Sentry is started in the Node.js runtime
- **THEN** its options contain neither `tracesSampleRate` nor `tracesSampler`

### Requirement: No request data in events
Sentry SHALL be started with every `dataCollection` field off, so that no event carries user info, cookies, HTTP headers, HTTP bodies, URL query parameters, GraphQL documents or variables, AI inputs or outputs, database query data, queue data or stack frame variables.

#### Scenario: Every field off
- **WHEN** Sentry is started
- **THEN** `dataCollection` has `userInfo`, `cookies`, `httpHeaders`, `urlQueryParams`, `databaseQueryData`, `queues` and `stackFrameVariables` set to `false`, `httpBodies` set to an empty list, `graphQL.document` and `graphQL.variables` set to `false`, and `genAI.inputs` and `genAI.outputs` set to `false`

### Requirement: Browser errors reach Sentry
The web application SHALL start Sentry in the browser, before the application becomes interactive, with the value of `SENTRY_DSN` inlined into the browser bundle at build time, so that uncaught exceptions and unhandled promise rejections in the browser are reported. The server, the CSP and the browser SHALL read the DSN from that one variable. The browser SHALL also send performance transactions: one for each initial page load carrying document Web Vitals (LCP, INP, CLS, FCP, TTFB), and one for each client-side navigation carrying route transition duration, INP and CLS, at a `tracesSampleRate` above 0 and at most 1. It SHALL start with no Session Replay and with every `dataCollection` field off. Without a DSN, the SDK sends nothing.

#### Scenario: DSN available to the browser
- **WHEN** the Next.js configuration is built with `SENTRY_DSN` set
- **THEN** its `env` exposes that value as `SENTRY_DSN` to the browser bundle

#### Scenario: Browser Sentry started with the DSN
- **WHEN** the client instrumentation file is loaded with `SENTRY_DSN` set
- **THEN** Sentry is started once, with that DSN

#### Scenario: Errors only in the browser
- **WHEN** Sentry is started in the browser
- **THEN** its `tracesSampleRate` is a number above 0 and at most 1, its options contain neither `replaysSessionSampleRate` nor `replaysOnErrorSampleRate`, and no integration passed to it is a replay integration

#### Scenario: No request data from the browser
- **WHEN** Sentry is started in the browser
- **THEN** its `dataCollection` is the same as the server's, with every field off

#### Scenario: Same data rules on both sides
- **WHEN** the server and the browser start Sentry
- **THEN** both take `dataCollection` from one shared definition, so a change to it applies to both

#### Scenario: No DSN, no transactions
- **WHEN** the client instrumentation file is loaded without `SENTRY_DSN`
- **THEN** the SDK has no DSN and sends no error and no transaction

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

### Requirement: Search breadcrumbs without request data

The browser SHALL add one Sentry breadcrumb when a search of `/planner` is sent and one when its answer arrives, so that a later browser error shows that a search ran. The breadcrumb of the answer SHALL say whether the search gave a ranking or which outcome stopped it, and how many chips and menus it shows. No breadcrumb SHALL carry the request text, the terms of the chips or the names of the dishes.

#### Scenario: Breadcrumb when a search is sent
- **WHEN** a signed-in user sends the search "garbanzos sin cerdo" with JavaScript
- **THEN** one breadcrumb of the planner category records that a search was sent, and none of its fields contains "garbanzos" or "cerdo"

#### Scenario: Breadcrumb when the answer arrives
- **WHEN** the answer of that search shows two chips and five menus
- **THEN** one breadcrumb records a ranking with two chips and five menus, and none of its fields contains a term or a dish name

#### Scenario: Breadcrumb of a failed search
- **WHEN** the answer of a search is the daily limit reached
- **THEN** one breadcrumb records the outcome `llm-limit-reached`, with no request text

### Requirement: Web Vitals without request data
A browser transaction or span SHALL carry the route of the page, its timings and applicable Web Vitals, and SHALL NOT carry the query string of the URL, the text of a request, the terms of a chip, the name of a dish or of a menu, cookies, headers, an IP address or user information.

#### Scenario: Transaction of a page with a query string
- **WHEN** a signed-in user opens `/menu?startsOn=2026-10-12` and the browser sends its page-load transaction
- **THEN** the transaction's name is the route `/menu` and no field or attribute contains "startsOn" or "2026-10-12"

#### Scenario: Transaction and span fields checked before sending
- **WHEN** a transaction or span is about to be sent with a query string in its URL or with a user, cookie or header field
- **THEN** the event or span that is sent has none of them

#### Scenario: Navigation transaction
- **WHEN** a signed-in user navigates from `/planner` to `/menu`
- **THEN** one navigation transaction named `/menu` is sent, carrying transition duration, CLS and INP, without pageload-only metrics like LCP or FCP

### Requirement: Trace headers stay on the app's own origin
The browser SHALL add Sentry trace headers (`sentry-trace` and `baggage`) only to requests to the app's own origin, so that no third party receives them.

#### Scenario: Request to the app's own origin
- **WHEN** the page sends a request to its own origin, such as a server action
- **THEN** the request may carry the Sentry trace headers

#### Scenario: Request to another origin
- **WHEN** the page sends a request to an origin that is not its own, including the Sentry ingest host
- **THEN** the request carries no `sentry-trace` or `baggage` header added by the SDK

### Requirement: Performance telemetry never breaks the page
A failure of the browser SDK to measure or to send a transaction, such as a blocked request or a Sentry outage, SHALL NOT change what the page renders or the answer of any action.

#### Scenario: Ingest blocked
- **WHEN** the browser cannot reach the Sentry ingest host
- **THEN** the page renders and every action answers as it does with Sentry reachable

#### Scenario: CSP unchanged
- **WHEN** the CSP is built with a valid https `SENTRY_DSN`
- **THEN** its `connect-src` lists `'self'` and the exact ingest origin of the DSN, and nothing else

### Requirement: Choosing breadcrumbs without request data

The browser SHALL add one Sentry breadcrumb when a menu of `/planner` is chosen and one when the answer arrives, so that a later browser error shows that a choice ran. Both SHALL say the week, `current` or `next`, and the breadcrumb of the answer SHALL say whether a menu was chosen or which outcome stopped it. No breadcrumb SHALL carry the request text of the search, the terms of the chips or the names of the dishes.

#### Scenario: Breadcrumb when a menu is chosen
- **WHEN** a signed-in user who searched "garbanzos sin cerdo" chooses a menu for next week with JavaScript
- **THEN** one breadcrumb of the planner category records that a menu was chosen for `next`, and none of its fields contains "garbanzos" or "cerdo"

#### Scenario: Breadcrumb when the answer arrives
- **WHEN** the choice is stored
- **THEN** one breadcrumb records the outcome `chosen` and the week, with no term or dish name

#### Scenario: Breadcrumb of a refused choice
- **WHEN** the choice is refused as a locked week
- **THEN** one breadcrumb records the outcome `week-locked`, with no request text
