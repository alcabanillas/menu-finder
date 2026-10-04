## Why

Roadmap item **MF-20.1**, first of three subtasks of MF-20 (`mf-20-1-auth-server` → `mf-20-2-…` account-creation command → `mf-20-3-…` login page and protected routes). MF-20 was split because it was ~5 h; each subtask is reviewed and archived on its own. Nothing of authentication exists yet, and MF-43 (`/planner` that saves the user's `Selection`), MF-21 (rate limits) and every protected screen depend on it. This change builds the server side only: the accounts, passwords and sessions, with sign-up closed. It also settles the question SEG-auth left open: how an account can be created from server code when public sign-up is off (SEG-sistema-cerrado).

**Result:** a test creates an account through the server API and signs in with it, and the public sign-up is rejected.

## What Changes

- **Authentication on the server** (SEG-auth): email and password, one role, public sign-up disabled, sessions stored in the database and sent in an `httpOnly` cookie with the SEG-auth window (7 days, renewed after 1 day). The library handles password hashing and session signing; no hash or session code of our own (safety-first P8).
- **Database tables** for users, accounts (credentials) and sessions, added by a new SQL migration with row-level security on every table and no policy, as in MF-41. Applied by `pnpm ingest migrate`.
- **A way to create an account from server code with sign-up disabled.** The mechanism is not chosen yet: task 1.1 is a short experiment on a Neon branch, and the author chooses (design D1). It is exercised by the test only; the command that uses it is MF-20.2.
- **A new secret**, `BETTER_AUTH_SECRET`, in `.env.local` (git-ignored) and, later, in Vercel.
- No page, no route handler, no CLI command, no rate limit (MF-21), no ownership checks (they need data of a user: MF-43).

## Capabilities

### New Capabilities
- `authentication`: who can have an account (nobody registers), how a user proves identity, and what a session is and how long it lasts.

### Modified Capabilities
- None. The new tables do not change the requirements of `search-index`; they only sit next to its tables in the same migrations folder.

## Impact

- **Code:** `src/infrastructure/auth/` (new, the server authentication setup built from a database pool and the secret), `postgres/migrations/` (one new SQL file), and its tests. `src/application/` is untouched: no port in this change (design D3). `src/composition/` is untouched until MF-20.2 and MF-20.3 need it.
- **Dependencies (new, justified in `design.md`):** the authentication library chosen in SEG-auth (`better-auth`). Checked on npm and against the 7-day wait rule before adding it (task 1.2).
- **Systems:** Neon branch `mf-20-1-auth-server` for development and tests; `production` gets the migration only when MF-20 is archived and the author runs it.
- **Config:** `BETTER_AUTH_SECRET` and the base URL, from the environment. No secret in the repo.

### Data touched

Email addresses and password hashes of the app's accounts (two in practice: the author and the demo account of SEG-sistema-cerrado) and session records. No nutritionist data. The demo credentials are never written in the repo, the slides or the video.

### Possible abuses and OWASP 2025 (SEG-owasp, `context/OWASP-Top10.md`)

| Category | Abuse | Control |
|---|---|---|
| A01 Broken access control | Anyone registers and reads the nutritionist's recipe text (SEG-sistema-cerrado) | Public sign-up is disabled; a test shows it is rejected and creates no row. |
| A02 Security misconfiguration | A default or missing secret; tables reachable without the owner role | No default for `BETTER_AUTH_SECRET`: the setup fails to start without it. RLS on every table, no policy, Data API off. |
| A04 Cryptographic failures | Passwords stored readable; forgeable session cookie | Hash by the library (checked in a test: the stored value is not the password); cookie signed with the secret, `httpOnly`. |
| A07 Authentication failures | Account enumeration by the error message; sessions that never expire | Wrong password and unknown email give the same answer; session lifetime and renewal fixed and tested. Brute force: MF-21. |
| A05 Injection | Hostile email or password (`' ; --`, emoji, very long) | Parameterised queries by the library; a test sends such values and checks that nothing breaks or changes. |
| A03 Supply chain | A look-alike or abandoned package; a version published hours ago | Package checked on npm, version at least 7 days old (OPS-ci-cd), listed in `design.md`. |
| A09 Logging and alerting | A login or a refused login nobody can see | **Deferred to MF-20.3**, where the HTTP entry point exists and the events can be logged with the user id (safety-first §4). Stated as a deviation below. |

### Decisions it relies on

SEG-auth, SEG-sistema-cerrado, SEG-roles, SEG-rate-limit (only to leave brute force out of scope), ARQ-modelo-datos, ARQ-hexagonal, OPS-calidad.

### Deviations and consequences

- **safety-first §4 (login logged):** this change introduces sign-in on the server but no entry point from outside, so there is nowhere to log from yet. MF-20.3 owns it. Not silent: it goes in the closing checklist of `tasks.md`.
- **SEG-auth "to verify at the start of MF-20":** resolved by task 1.1. Depending on the result, `context/decisiones.md` §1.8 SEG-auth changes in task 5.x, and MF-20.2 takes the shape of the chosen mechanism.
- **ARQ-modelo-datos:** says the Better Auth tables come with MF-20; this change adds exactly those and none of `Selection` or `UserShoppingItem` (MF-43, MF-24).
