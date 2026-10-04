## Why

Roadmap item **MF-20.2**, second of three subtasks of MF-20 (`mf-20-1-auth-server` archived → `mf-20-2-cli-create-account` → `mf-20-3-…` login page and protected routes). MF-20.1 left a function that creates accounts (`createAccountCreator`, with the open-sign-up instance of its design D1) that nothing calls. The system is closed (SEG-sistema-cerrado): the only way to get an account is a command the author runs, and MF-20.3 cannot be tried in a browser until one exists. The tutor's demo account is made the same way.

**Result:** the command creates an account, and signing in with it works.

## What Changes

- **A CLI command to create an account:** `pnpm ingest account <email> [name]`. It creates one user with one credential account, or fails with a line that says why. The demo account is created with this same command; there is no demo-specific code.
- **The password never travels in an argument or an environment variable.** The command asks for it with no echo when stdin is a terminal, and reads one line from stdin otherwise (scripts, the demo account). It is never printed, and error text goes through `redactSecrets`.
- **A port and a use case** (`AccountCreator`, `createAccount`), as MF-20.1 design D3 announced. The existing function becomes the adapter of that port, and its error type moves to `application/`. The CLI composition root builds it with the pool of the direct connection and `BETTER_AUTH_SECRET`.
- **An email that already has an account is an error**, and the existing account and its password are unchanged. Changing a password is a different operation, left to a new roadmap item (see Deviations).
- No page, no route, no change to the closed instance used by the web (MF-20.3), no rate limit (MF-21).

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `authentication`: adds the requirement that accounts are created from a CLI command, with how the password is received and what the command reports. The requirement "Accounts are created from server code only" keeps its meaning.

## Impact

- **Code:** `src/application/ports/account-creator.ts` and `src/application/use-cases/create-account.ts` (new); `src/infrastructure/auth/create-account.ts` (implements the port); `src/composition/cli-container.ts`; `src/cli/commands/create-account.ts` (new), `src/cli/run-cli.ts` and `src/cli/index.ts` (the command and the password reading); their tests.
- **Dependencies:** none new. The no-echo prompt uses Node's own `readline` and `tty`.
- **Systems:** Neon development branch for the integration test; `production` gets its accounts only when the author runs the command there, after MF-20 is archived.
- **Config:** `BETTER_AUTH_SECRET` and `DATABASE_URL_UNPOOLED`, already in `.env.local`. No new variable.

### Data touched

Email addresses, names and password hashes of the app's accounts (two in practice: the author and the demo account). The plain password exists only in the memory of the command while it runs. No nutritionist data. The demo credentials are never written in the repo, the slides or the video.

### Possible abuses and OWASP 2025 (SEG-owasp, `context/OWASP-Top10.md`)

| Category | Abuse | Control |
|---|---|---|
| A07 Authentication failures | The password stays in the shell history or in `ps` (argument), or in a file (environment variable) | Read from a no-echo prompt or stdin, never from arguments or the environment; a test shows the password is not in any printed line. |
| A04 Cryptographic failures | The password stored readable, or printed in an error | Stored hashed by the library (MF-20.1 test); every error line goes through `redactSecrets`; a test sends a failing creation and searches the output for the password. |
| A01 Broken access control | The open-sign-up instance reached from the web | Unchanged ESLint rule of MF-20.1 (`web-container.ts` and `app/` cannot import it); its test must stay green. |
| A05 Injection | Hostile email or name (`' ; --`, emoji, null byte, 10 000 characters) | Validated before any query; parameterised queries by the library; tests with those values. |
| A02 Security misconfiguration | The command runs with no secret or against the wrong database | Missing variables are named and nothing connects (pattern of the other commands); the secret check of MF-20.1 stays. |
| A09 Logging and alerting | An account created with nobody noticing | The command prints the email and the new user id; there is no server log because the CLI is run by the author (stated under Deviations). |

### Decisions it relies on

SEG-sistema-cerrado, SEG-auth (creation of accounts verified in MF-20.1), SEG-roles, ING-cli-local (commands in `src/cli/`), ARQ-hexagonal, OPS-calidad.

### Deviations and consequences

- **MF-20.1 design D3 and the port rule of `AGENTS.md`:** the existing ports (`DocumentSource`, `EmbeddingsPort`, `MenuRepository`, `RecipeRepository`, `RecipeEmbeddingRepository`, `MigrationRunner`) cover none of identity, so a new port is justified; `design.md` says so.
- **Password change is out of scope.** Re-creating an account would change its user id and orphan its sessions and, from MF-43, its `Selection` rows; the library has no public server call to change a password with sign-up closed. A new roadmap item, "change a password from the CLI", is added at the end of this change, with the author's agreement, rather than widening a 1.5 h subtask.
- **Safety-first §4, sign-in log:** still owned by MF-20.3. The Postgres integration tests of this change are skipped in CI until MF-44, as in MF-20.1.
