## ADDED Requirements

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

#### Scenario: No source map served
- **WHEN** the production build is served and the browser requests any script under `/_next/static`
- **THEN** no `.map` file exists in the public build output and no script references one with `sourceMappingURL`

#### Scenario: Security headers kept
- **WHEN** the Next.js configuration is wrapped for Sentry
- **THEN** it still sends the fixed security headers and no `X-Powered-By`
