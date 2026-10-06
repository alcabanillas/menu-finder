# test-isolation Specification

## Purpose

Defines where the automated tests may write and what they leave behind: the end-to-end run uses only the test database and deletes its account, and the schemas of the integration tests do not outlive their run.

## Requirements

### Requirement: The end-to-end run uses only the test database

The server the end-to-end run starts, and the CLI it calls to create its account, SHALL connect to the test database (`DATABASE_URL_TEST`) for both the pooled and the direct connection, whatever `.env.local` says for the app. The run SHALL start its own server on a port different from the development server's, and SHALL NOT reuse a server already running.

#### Scenario: Test database configured
- **WHEN** `DATABASE_URL_TEST` is set in the environment or in `.env.local`
- **THEN** the server environment of the end-to-end run has `DATABASE_URL` and `DATABASE_URL_UNPOOLED` equal to that URL

#### Scenario: The app database is never passed to the server
- **WHEN** `.env.local` has a `DATABASE_URL` different from `DATABASE_URL_TEST`
- **THEN** that app URL appears nowhere in the server environment of the end-to-end run

#### Scenario: No test database configured
- **WHEN** `DATABASE_URL_TEST` is set neither in the environment nor in `.env.local`
- **THEN** the database variables of the server point to an unreachable host, and the sign-in tests that need the database are skipped

#### Scenario: Own server on its own port
- **WHEN** the end-to-end run starts
- **THEN** its server listens on a port other than 3000 and an already running server is not reused

### Requirement: The test database is migrated before the end-to-end run

Before the end-to-end tests run, the pending migrations SHALL be applied to the test database, and to no other database.

#### Scenario: Pending migrations applied to the test database
- **WHEN** the end-to-end run starts with `DATABASE_URL_TEST` set
- **THEN** the migrations are applied with the direct connection set to `DATABASE_URL_TEST`

#### Scenario: Nothing is migrated without a test database
- **WHEN** the end-to-end run starts without `DATABASE_URL_TEST`
- **THEN** no migration runs

### Requirement: The end-to-end account is deleted

The account the sign-in tests create SHALL be deleted from the test database when those tests finish, together with its sessions.

#### Scenario: Account removed after the sign-in tests
- **WHEN** the sign-in tests finish
- **THEN** exactly one account with the run's email is deleted from the test database, and no account with that email remains

### Requirement: Integration test schemas do not outlive their run

Each integration test schema SHALL carry its creation time in its name. Before each run of the integration tests, the schemas left by earlier runs that were cut short SHALL be dropped, and a test database whose migration fails SHALL drop its own schema.

#### Scenario: Stale schema dropped before a run
- **WHEN** the test database has a test schema created more than one hour ago
- **THEN** the cleanup before the run drops it

#### Scenario: Schema of a run in progress kept
- **WHEN** the test database has a test schema created less than one hour ago
- **THEN** the cleanup does not drop it

#### Scenario: Only test schemas can be dropped
- **WHEN** the test database has `public`, or a schema whose name does not match the test pattern exactly (for example `test_notes`)
- **THEN** the cleanup does not drop it, whatever its age

#### Scenario: Failed migration drops its schema
- **WHEN** creating a migrated test database fails on a migration
- **THEN** the error is reported and the schema it created no longer exists
