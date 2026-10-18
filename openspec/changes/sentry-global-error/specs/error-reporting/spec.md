## ADDED Requirements

### Requirement: Render errors reach Sentry
The web application SHALL report to Sentry every React render error that reaches an error boundary of the App Router: `src/app/error.tsx` for pages and nested layouts, and `src/app/global-error.tsx` for the root layout. Each boundary SHALL report the error once per error instance and SHALL replace the broken UI with a fixed fallback message and a button that calls `retry`. The fallback SHALL NOT show the error message, stack or digest.

#### Scenario: Page render error
- **WHEN** a page throws while rendering in the browser
- **THEN** `Sentry.captureException` is called once with that error, and the page shows the fallback of `error.tsx` inside the app layout

#### Scenario: Root layout render error
- **WHEN** the root layout throws while rendering in the browser
- **THEN** `Sentry.captureException` is called once with that error, and the page shows the fallback of `global-error.tsx` with its own `<html>` and `<body>`

#### Scenario: Re-render does not report again
- **WHEN** a boundary re-renders with the same error instance
- **THEN** `Sentry.captureException` is not called again

#### Scenario: Try again
- **WHEN** the user presses "Try again" in either fallback
- **THEN** the `retry` function Next.js passed to the boundary is called

#### Scenario: Error text hidden from the user
- **WHEN** a boundary receives an error whose message is `SELECT * FROM menus failed` and whose digest is `abc123`
- **THEN** neither text appears in the fallback

#### Scenario: No request data from the boundary
- **WHEN** a boundary reports an error
- **THEN** it passes only the error to Sentry, with no extra context, tags, user or request fields

### Requirement: Events carry their environment
The server and the browser SHALL start Sentry with `environment` set to the value of `VERCEL_ENV` (`production`, `preview` or `development`), and to `NODE_ENV` when `VERCEL_ENV` is unset or empty. The browser SHALL receive the value inlined at build time by `next.config.ts`, so both sides report the same label.

#### Scenario: Vercel production
- **WHEN** Sentry starts with `VERCEL_ENV` set to `production`
- **THEN** its `environment` option is `production`

#### Scenario: Vercel preview
- **WHEN** Sentry starts with `VERCEL_ENV` set to `preview`
- **THEN** its `environment` option is `preview`

#### Scenario: Outside Vercel
- **WHEN** Sentry starts with `VERCEL_ENV` unset and `NODE_ENV` set to `development`
- **THEN** its `environment` option is `development`

#### Scenario: Never empty
- **WHEN** Sentry starts with `VERCEL_ENV` set to an empty string
- **THEN** its `environment` option is `NODE_ENV`, not an empty string

#### Scenario: Same label on both sides
- **WHEN** the browser bundle is built with `VERCEL_ENV` set to `preview`
- **THEN** `next.config.ts` inlines `preview` and the server reads `preview`
