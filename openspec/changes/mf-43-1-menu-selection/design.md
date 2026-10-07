## Context

No table, port or use case holds per-user data yet. The 36 menus are global rows written by the CLI (`menu`, `meal`, `menu_dish`; migration `001-search-schema.sql`), read through `MenuRepository.list()` (MF-42, "shared with MF-43"). The signed-in user reaches the code as `SignedInUser.userId` from `requireUser()` (`src/app/_session/require-user.ts`); pages and actions pass it into use cases explicitly. The web container (`src/composition/web-container.ts`) already opens a `pg.Pool` on the pooled `DATABASE_URL`, but only for Better Auth.

`pnpm ingest menu` replaces menus by deleting and reinserting their `menu` rows in one transaction (`src/infrastructure/postgres/postgres-menu-repository.ts`, `write`). Any foreign key to `menu` has to live with that.

The web still connects as the owner role: MF-17 (the app's own role and its `GRANT`s) is not done, so this migration grants nothing; MF-17 grants on every app table, `selection` included.

## Goals / Non-Goals

**Goals:**
- One table holds the active menu, the next one and the history, with every rule derived from two dates.
- The start-date rule and the "which is active" rule are pure functions, tested without a database.
- The port is a contract small enough that the core and the adapter can be built in parallel (D7).

**Non-Goals:**
- The `/planner` screen and its server action (MF-43.2).
- A history page (`context/decisiones.md` §2, point 5).
- `UserShoppingItem` (MF-24). This change only keeps the door open for it to hang from `selection.id`.
- RLS policies (MF-48).

## Decisions

### D1. One table; dates as the only state
```sql
CREATE TABLE selection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  menu_number integer NOT NULL REFERENCES menu (number) DEFERRABLE INITIALLY DEFERRED,
  selected_at timestamptz NOT NULL DEFAULT now(),
  starts_on date NOT NULL CHECK (EXTRACT(ISODOW FROM starts_on) = 1),
  UNIQUE (user_id, starts_on)
);
ALTER TABLE selection ENABLE ROW LEVEL SECURITY;
```
There is no "current" flag and no history table: both would duplicate what `starts_on` already says and could drift. `selected_at` is stored for the history and for MF-25, but no rule reads it. `id` is a surrogate key because MF-24's ticks need something to hang from that changes when the user changes the menu of a week (D4). `user_id` follows the snake_case of the app tables and points to Better Auth's quoted camelCase `"user"."id"` (`002-auth-schema.sql`); deleting a user deletes their selections.

Alternative: a natural key `(user_id, starts_on)`. Rejected: replacing the menu of a week would keep the same key, and MF-24's ticks would survive onto a different menu.

### D2. Today is a calendar date in Europe/Madrid, from a `Clock` port
Dates travel through the core as `LocalDate`, an ISO `YYYY-MM-DD` string type, never as `Date`, so no time zone leaks into the rules. `Clock.today(): LocalDate` is the port (ADR-001 §4 lists `ClockPort`); `SystemClock` in `src/infrastructure/clock/` formats `new Date()` with `Intl.DateTimeFormat` in `Europe/Madrid`, and takes the instant as a constructor argument for its tests. On Vercel the process runs in UTC, so between 00:00 and 02:00 Madrid time a UTC date would be the day before; the spec has a scenario for it.

In the adapter, `starts_on` is read as `starts_on::text` and written as `$n::date`. `pg` would otherwise turn a `date` column into a `Date` at local midnight, which is the bug D2 avoids.

### D3. The foreign key to `menu` is deferred
A plain key with `ON DELETE CASCADE` would wipe every user's selections each time the menus are re-ingested; with `RESTRICT` or `NO ACTION` the ingestion would fail as soon as anyone has chosen a menu. `DEFERRABLE INITIALLY DEFERRED` checks the key at commit: the ingestion deletes and reinserts the same menu numbers in one transaction, so at commit every selection points to an existing menu again. A menu that really disappears still makes the commit fail, which is right: the CLI never removes menus it did not receive (`MenuRepository.saveAll`).

It also means that inserting a selection for a missing menu fails at commit, not at the `INSERT`. The adapter runs its write in a transaction and maps the `23503` error of the commit to `unknown-menu`.

Alternative: no foreign key, and the use case checks the menu exists through `MenuRepository`. Rejected: one more query per choice, and the database would accept orphans from any other writer.

`shopping_item` has the same pattern with `ON DELETE CASCADE` (`004-shopping-list.sql`): re-ingesting the menus deletes every shopping list. That is outside this change; it is reported to the author.

### D4. Replacing a week's choice is delete and insert
`SelectionRepository.replace` deletes the user's row for that `starts_on` and inserts the new one in the same transaction, so the new selection has a new `id` (D1). Two simultaneous choices for the same week may make one of them hit the unique key; that one fails with `failed` and the user tries again. Accepted: one person, one account.

### D5. The rules are domain functions
`src/domain/selection/`:
- `selection.ts`: `type Selection = { id: string; menuNumber: number; startsOn: LocalDate }` and `type CurrentSelections = { activeMenu: Selection | null; shoppingList: Selection | null }`.
- `local-date.ts`: `LocalDate`, `mondayOf(date)`, `addDays(date, days)`, `isMonday(date)`. Arithmetic in UTC on the parsed date, so no daylight-saving change moves a day.
- `week.ts`: `startsOnFor(today, selectionsFromThisMonday)` and `currentOf(selectionsFromThisMonday, today)`.

Both rules only need the selections that start on this week's Monday or later: an older one cannot be active, because every week ends on its Sunday. So one query serves both use cases.

### D6. The port and the use cases
```ts
// src/application/ports/selection-repository.ts
export type SelectionWriteError = { kind: 'unknown-menu' } | RepositoryError;
export interface SelectionRepository {
  /** The user's selections starting on `from` or later, ordered by start date. */
  listFrom(userId: string, from: LocalDate): Promise<Result<Selection[], RepositoryReadError>>;
  /** Stores the choice, replacing the user's selection of the same start date (D4). */
  replace(userId: string, choice: { menuNumber: number; startsOn: LocalDate }): Promise<Result<Selection, SelectionWriteError>>;
}
// src/application/ports/clock.ts
export interface Clock { today(): LocalDate }
```
- `selectMenu({ selections, clock }, { userId, menuNumber })`: `menuNumber` is `unknown`, like `SignInInput` (`src/application/use-cases/sign-in.ts`), because a form sends strings. A Zod schema accepts a positive safe integer or a string of digits only (`"12abc"` and `"1.5"` are refused). Then it reads `listFrom(userId, mondayOf(today))`, computes `startsOnFor`, and calls `replace`. It returns `Result<Selection, { kind: 'invalid-menu' | 'unknown-menu' | 'failed' }>`.
- `currentSelections({ selections, clock }, { userId })`: `listFrom` and `currentOf`. It returns `Result<CurrentSelections, { kind: 'failed' }>`.

`userId` is an argument, never read inside: the web adapter takes it from the session (MF-43.2), as with every other web use case. Both are wired in the web container, with `PostgresSelectionRepository` on the pool the container already has, and `SystemClock`.

Why a new port: no existing one holds per-user data. `MenuRepository` is the global catalogue, written only by the CLI; adding the user's rows to it would mix data with different writers and permissions (the reuse check of `AGENTS.md`).

### D7. Built in parallel, in three steps
1. **Contract** (one agent, first): `local-date.ts` (the type and its functions, with tests), the `Selection` and `CurrentSelections` types, and the two ports. Committed before the next step.
2. **In parallel**, each in its own worktree from that commit:
   - **Core**: `week.ts`, `select-menu.ts`, `current-selections.ts`, with unit tests against an in-memory fake of `SelectionRepository` and a fixed `Clock`.
   - **Infrastructure**: `005-selection.sql`, `PostgresSelectionRepository` and `SystemClock`, with integration tests against the Neon `test` branch.
   Neither edits the contract; a change to it stops the work and goes back to step 1.
3. **Integration** (one agent): merge both, wire the web container, run the whole suite.

## Risks / Trade-offs

- [No RLS policy until MF-48] → every query of the adapter filters by `user_id`, and two spec scenarios check isolation between users.
- [The deferred foreign key moves the error to the commit] → the adapter always writes in a transaction and maps the error there (D3); a test covers menu 999.
- [The running week's menu cannot be corrected] → accepted by the author for the MVP; written in the proposal.
- [`shopping_item` is wiped by re-ingesting the menus] → out of scope; reported (D3).
