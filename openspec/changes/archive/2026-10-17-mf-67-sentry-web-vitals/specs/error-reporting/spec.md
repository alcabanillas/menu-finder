# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Errors only`
- TO: `### Requirement: No server tracing`

## MODIFIED Requirements

### Requirement: No server tracing
The Node.js server SHALL start Sentry with neither `tracesSampleRate` nor `tracesSampler`, so that no server transaction or span is sent.

#### Scenario: No tracing options
- **WHEN** Sentry is started in the Node.js runtime
- **THEN** its options contain neither `tracesSampleRate` nor `tracesSampler`

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

## ADDED Requirements

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
