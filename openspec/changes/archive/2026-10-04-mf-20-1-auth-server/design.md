## Context

See `proposal.md` for the motivation. Constraints that shape the approach:

- **Hexagon (ADR-001):** the authentication library lives in `infrastructure/` (SEG-auth). `application` cannot import it, and `app/` and `cli/` cannot import `infrastructure` directly. A port exists only at a real external boundary (ADR-001 §4); the ports that MF-20.2 (create an account from the CLI) and MF-20.3 (read the session from the web) need are designed in those changes, when their callers exist.
- **Existing ports read for this design** (`src/application/ports/`): `DocumentSource`, `EmbeddingsPort`, `MenuRepository`, `RecipeRepository`, `RecipeEmbeddingRepository`, `MigrationRunner`, `RepositoryError`. None covers identity or sessions, so there is nothing to reuse; `MigrationRunner` is reused as it is for the new SQL file.
- **Database:** migrations are numbered SQL files in `postgres/migrations/` (`001-search-schema.sql` exists), applied by `PostgresMigrationRunner` inside one transaction each. Integration tests run on a Neon branch through `DATABASE_URL_TEST`, one schema per test file (`infrastructure/postgres/test-database.ts`). For this change the development branch is `mf-20-1-auth-server`, a copy of `production`.
- **Neon Auth is off** and stays off: the library runs in our app and Neon is only the database (MF-41 design).
- **Nothing in the repo uses the library yet:** `better-auth` is not in `package.json`.

**Status of the decisions below:** D1 to D6 are **decided** (2026-10-04: D1 after task 1.1, D2 to D6 confirmed by the author right after). D7 is a test technique, not a design choice. Nothing is copied to `context/decisiones.md` before task 5.2. Until then nothing is copied to `context/decisiones.md`.

## Goals / Non-Goals

**Goals:**
- The server side of authentication, tested end to end against a real database, with sign-up closed.
- The mechanism that creates accounts from server code, chosen on evidence, so that MF-20.2 only has to wrap it in a command.
- Tables and secret handling in their final form: nothing here is redone in MF-20.2, MF-20.3 or MF-21.

**Non-Goals:**
- The login page, the route handler, route protection and the sign-out button (MF-20.3).
- The command that creates accounts and the demo account (MF-20.2).
- Rate limits on login (MF-21; the library supports a database counter, not configured here).
- Logging of sign-ins and refused sign-ins (MF-20.3, see proposal "Deviations").
- Per-user data and its ownership checks (MF-43 and later).

## Decisions

### D1. How an account is created from server code with sign-up closed

**Decided by the author (2026-10-04): option (c), after the experiment of task 1.1.** The library documentation read while planning does not say whether closing sign-up also blocks the server-side sign-up call. Task 1.1 tries these on a throwaway branch, with a test for each:

| Option | What it is | Known cost |
|---|---|---|
| (a) Server sign-up call | The library's own server function that creates an email-and-password user, called from code | Cheapest, but only works if closing sign-up does not block it |
| (b) Internal adapter | Create the user and the credential account through the library's internal data access, hashing the password with the library's own hash function | Works whatever the flag says; uses an internal surface that may change between versions |
| (c) A second instance | A second authentication setup with sign-up open, built only by the composition root of the CLI and never mounted on a route | Robust and simple to read; two configurations to keep consistent, and the open one must be impossible to import from `app/` (ESLint boundary) |

Rejected before the experiment: the library's `admin` plugin. It adds a role and user-management endpoints, against SEG-roles (one role, no user management in the app).

**Result of the experiment (task 1.1, `better-auth` 1.7.6, throwaway schema on the branch `mf-20-1-auth-server`, dropped afterwards):**

| Option | Result |
|---|---|
| (a) | **Blocked.** With sign-up closed, the server call fails with `EMAIL_PASSWORD_SIGN_UP_DISABLED`, and so does `POST /api/auth/sign-up/email` (HTTP 400). The check is inside the endpoint handler (`dist/api/routes/sign-up.mjs`), so the server call goes through it too. |
| (b) | **Works.** `ctx.password.hash`, then `internalAdapter.createUser` and `linkAccount` with provider `credential`; a sign-in on the closed instance then returns a token. The stored password value is `salt:key` in hex, not the password. |
| (c) | **Works.** `signUpEmail` on an open instance, then a sign-in on the closed one with the same pool and secret. With `autoSignIn: false` it leaves no session behind (the only sessions were the two sign-ins of the test). |

Other findings: the library warns when the secret has low entropy (a point for D4); `telemetry` is off unless `BETTER_AUTH_TELEMETRY` or `telemetry.enabled` is set, and the setup sets it to `false` explicitly; the generator lists exactly four tables (`user`, `session`, `account`, `verification`).

**Chosen: (c).** It uses only the library's public sign-up call, so it does not depend on internals the way (b) does, and the open instance exists only in the composition root of the CLI. `app/` already cannot import `infrastructure/` (ADR-001 §3, boundaries rule), but `composition/` can import everything, so a future `web-container.ts` is closed with its own rule (task 3.8). (b) was the alternative, with a single configuration but a creation function that no test can keep out of the web; (a) is discarded by the experiment. Consequence: the open instance exists only in the composition root of the CLI, and the rule of task 3.8 on `web-container.ts` is not optional.

### D2. Schema

**Decided by the author (2026-10-04).** The SQL comes from the library's schema generator for PostgreSQL, is reviewed by hand and saved as `postgres/migrations/002-auth-schema.sql`. Table names are the library's defaults (`user`, `session`, `account`, `verification`). `verification` stays: the library expects it, even though a closed system with no email never writes to it. Every table gets row-level security and no policy, as in `001-search-schema.sql`. `user` is a reserved word in PostgreSQL: the generated SQL must quote it, and the review checks it.

Done with the library's own schema compiler called from code (`getMigrations(...).compileMigrations()`), not with its `npx` CLI: same generator, and no extra package is downloaded and run. Alternative: the library's own `migrate` command. Rejected: it writes to the database outside `pnpm ingest migrate`, with no record in the migration table and no review of the SQL.

### D3. No new port

**Decided by the author (2026-10-04).** This change delivers `infrastructure/auth/`: one function that builds the authentication instance from a database pool, the secret and the base URL, with the session values written out. No use case, no port, no composition change. MF-20.2 adds the account-creation port and use case; MF-20.3 adds the session-reading port.

Alternative: a port now (`AccountCreator`, `SessionReader`). Rejected: nothing would call it in this change, and its shape depends on D1.

What MF-20.2 moves out of `infrastructure/auth/` when it adds the port and the use case (decided by the author in verify, 2026-10-04): the email rule of D6 (254 characters, no control characters) goes to `domain/account/` and the use case applies it, keeping the null-byte check in the adapter only as a defence for PostgreSQL; `AccountError` goes to the port in `application/ports/`; `create-account.ts` is renamed after its technology (for example `better-auth-account-creator.ts`), and the ESLint rule of task 3.8 follows the new path.

### D4. Secret and base URL

**Decided by the author (2026-10-04).** `BETTER_AUTH_SECRET` signs the session cookie (it does not protect the passwords, which use the library's scrypt hash). It has no default: the setup throws an error naming the variable when it is missing or shorter than 32 characters, and the error never prints the value. One secret per environment (local, Vercel, demo); changing it signs everyone out. The base URL is `BETTER_AUTH_URL`. The web will use the pooled Neon URL and the CLI the direct one (ADR-001 §5); this change only receives a pool and does not choose.

### D5. Session settings

**Decided by the author (2026-10-04).** `expiresIn` 7 days and `updateAge` 1 day are written explicitly in the configuration, although they are the library's defaults (SEG-auth), so a test can assert them and a library upgrade cannot change them silently. The cookie is `HttpOnly` and `Secure` in production.

The library's schema check at start-up is off (`advanced.database.validateSchema: false`; decided by the author in verify, 2026-10-04). It reads every schema of the database through Kysely's introspector, so it failed about one test run in five when another test file dropped its schema at the same moment, and in production it would read the whole catalogue on every cold start. In its place, `auth-schema.test.ts` asks the library's `getMigrations` for pending tables, columns and indexes against the migrated schema, and expects none; that test keeps the same race, contained in one test with a retry.

### D6. Password limits

**Decided by the author (2026-10-04).** Minimum 8 and maximum 128 characters, the library's defaults; no composition rules. The maximum matters: scrypt on a 10 000-character password is a cheap way to burn CPU. The author confirms or changes the numbers in task 1.1.

The email is capped at 254 characters (RFC 5321) and may not contain control characters, checked by the account creator before any query (decided by the author in verify, 2026-10-04). The library caps neither: a 10 000-character address was stored, and a null byte reached PostgreSQL and came back as an error naming its encoding.

### D7. How the tests control time and state

Tests run on the migrated test schema (`createMigratedTestDatabase`). Session expiry and renewal are tested by writing `expires_at` and `updated_at` of the session row directly and then reading the session; no fake timers inside the library. The "no secret" and "other secret" scenarios build two instances with different secrets over the same pool.

## Risks / Trade-offs

- **The experiment (1.1) may eat half the 2 h** → timebox it to 30 minutes. If no option works cleanly, stop and take the problem to the author instead of widening the change.
- **A new dependency with a large transitive tree** → checked in task 1.2: `better-auth` exists on npm (maintainer `bekacru`, repository `better-auth/better-auth`); version **1.7.6** is pinned exactly because 1.7.7 (2026-09-30) is under the 7-day wait of OPS-ci-cd and 1.7.6 is from 2026-09-24; `pnpm audit --prod` finds only the four Genkit advisories already accepted in MF-41, none through `better-auth`. `osv-scanner` is not installed locally, so its check runs in CI on the PR. Re-check when 1.7.7 turns 7 days old (2026-10-07).
- **Generated SQL that does not match what the library queries** → the test suite signs up, signs in and expires sessions against the migrated schema, so a mismatch fails there.
- **(b) or (c) leave two ways in** → for (c), an ESLint rule forbids `composition/web-container.ts` to import the open setup (`app/` is already closed by the layer rules), with a test that lints a snippet as if it were in each file; for (b), the creation function is not exported outside `infrastructure/auth/`.
- **(c) still reads through one internal surface** → the library answers a sign-up for an existing email with a generic success, so the account creator asks first with `internalAdapter.findUserByEmail` (`infrastructure/auth/create-account.ts`). It is a read only, and the test "refuses an email that already has an account" fails if a library upgrade changes it.
- **No sign-in logging yet** → accepted for this change only; MF-20.3 closes it before the app is reachable.

## Migration Plan

Apply `002-auth-schema.sql` to the development branch with `pnpm ingest migrate`; the tests build their own schemas. `production` gets it when the author runs `pnpm ingest migrate` against it after the archive; the tables are new, so rollback is dropping them. The secret is generated locally with a random 32-byte value and put in `.env.local`; Vercel gets its own in MF-26.
