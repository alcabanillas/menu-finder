## ADDED Requirements

### Requirement: Browser errors can reach only the project's Sentry
When `SENTRY_DSN` holds a valid `https` URL, the `Content-Security-Policy` of every page SHALL include a `connect-src` directive with `'self'` and the exact origin of the DSN host (`https://<host>`), and nothing else. A wildcard host SHALL never be added. When the DSN is not set, is not a valid URL or does not use `https`, the policy SHALL have no `connect-src` directive, so connections fall back to `default-src 'self'`. The DSN's public key and project id SHALL NOT appear in the policy.

#### Scenario: Exact ingest host allowed
- **WHEN** the policy is built with the DSN `https://public@o123.ingest.de.sentry.io/456`
- **THEN** it contains `connect-src 'self' https://o123.ingest.de.sentry.io`

#### Scenario: The app keeps talking to itself
- **WHEN** the policy is built with a valid DSN
- **THEN** `connect-src` contains `'self'`, so the requests of the app to its own origin are not blocked

#### Scenario: No wildcard
- **WHEN** the policy is built with any valid DSN
- **THEN** no directive contains `*`

#### Scenario: Key and project kept out
- **WHEN** the policy is built with the DSN `https://public@o123.ingest.de.sentry.io/456`
- **THEN** the policy contains neither `public` nor `456`

#### Scenario: No DSN
- **WHEN** the policy is built with `SENTRY_DSN` not set
- **THEN** it has no `connect-src` directive and is otherwise unchanged

#### Scenario: Invalid DSN
- **WHEN** the policy is built with the DSN `not a url`, `http://public@o123.ingest.de.sentry.io/456` or `javascript:alert(1)`
- **THEN** it has no `connect-src` directive

#### Scenario: Injected directive in the DSN
- **WHEN** the policy is built with the DSN `https://public@o123.ingest.de.sentry.io/456; script-src *`
- **THEN** the policy contains no `script-src *` and no second `script-src` directive
