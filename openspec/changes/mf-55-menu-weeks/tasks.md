## 1. Week resolution (domain, pure)

- [x] 1.1 RED: test `resolveStartsOn` returns the requested Monday when it is inside `[today − 70 days, today + 7 days]`, including both boundary Mondays (scenarios "Going back", "Going forward", boundary Mondays)
- [x] 1.2 RED: test `resolveStartsOn` returns the current Monday for every negative scenario of "The startsOn parameter is validated": `not-a-date`, `2026/10/05`, `05-10-2026`, `2026-10-5`, `2026-02-30`, `2026-13-01`, leading/trailing space, a Wednesday, an array (repeated parameter), an oversized string, an injection-shaped string, `undefined`
- [x] 1.3 RED: the invalid inputs never reach date parsing. Checked by behaviour, not by spying on `Date`: an oversized value and a valid Monday followed by extra characters both fall back. (Changed from the original "spy on the parser")
- [x] 1.4 RED: test a week older than 70 days and a week beyond next week fall back to the current Monday
- [x] 1.5 GREEN: implement `resolveStartsOn(raw: unknown, today: LocalDate)` in `src/domain/selection/starts-on.ts` with the six steps of `design.md` D1, in that order
- [x] 1.6 REFACTOR: window limits named once as constants (`WEEKS_BACK`, `WEEKS_AHEAD`)

## 2. Look-back read (selection and menu)

- [x] 2.1 Integration test for `listFrom` with the 10-week bound (`postgres-selection-repository.test.ts`, "reads the ten-week window"). Passed against the test database in `.env.local`. Written after the query, so it characterises existing SQL rather than failing first
- [x] 2.2 Test that an empty user id returns no selection (scenario "Read without a user id"), in the same file. Passed against the test database
- [x] 2.3 GREEN: `weekMenu` calls `listFrom` with `earliestStartsOn(today)`. No SQL change was needed; the existing `starts_on >= $2` query already applies the bound
- [x] 2.4 RED → GREEN: `weekMenu` reads one menu with `menus.find`. The use case receives only `find` from the menu repository, so `list` cannot be called by type (`week-menu.test.ts`)
- [x] 2.5 RED → GREEN: a selection whose menu is missing gives a failure, not an empty week (`week-menu.test.ts`)
- [x] 2.6 GREEN: `weekMenu` in `src/application/use-cases/week-menu.ts`, reusing `selectedWeek` (`selected-week.ts`), which `activeMenu` now also uses
- [x] 2.7 Added: `menuWeekPage` (`src/application/use-cases/menu-week-page.ts`) validates the raw `startsOn`, calls `weekMenu` and returns the navigation DTO. The page only passes the raw value through the web container

## 3. Page and composition

- [x] 3.1 RED → GREEN: `WeekNav` (`src/features/weekly-menu/components/week-nav.tsx`) shows previous and next controls, disables them at the window limits without removing them, and offers "Esta semana" only when another week is shown
- [x] 3.2 RED → GREEN: `EmptyMenu` with `reason="unchosen-week"` for past and next weeks; the current-week copy is unchanged
- [x] 3.3 GREEN: header navigation and the empty-state variant live in `src/features/weekly-menu/`, receiving data through props (DTO `WeekNavigationDto`, no domain import, per ESLint boundaries)
- [x] 3.4 RED → GREEN: `app/(signed-in)/menu/page.tsx` awaits `searchParams`, calls `webContainer().menuWeekPage`, and keeps `requireUser()` as the only source of the user. The page comment no longer says the URL is unused
- [x] 3.6 RED → GREEN: page test that a session-less request ends in the redirect before any week is read
- [x] 3.5 E2E in `e2e/menu-weeks.spec.ts`: back and next arrows, disabled control beyond next week, empty past week with back arrow enabled, invalid `startsOn`, a week older than ten weeks, another user's past week hidden. 6/6 pass on chromium against the test database. The session-less redirect is already covered by `e2e/menu.spec.ts`

## 4. Verification and close

- [x] 4.1 `tsc --noEmit`, `eslint src`, `knip` and `vitest run` are green (128 files, 1157 tests). Used `npx` equivalents of `pnpm lint` and `pnpm test`
- [x] 4.2 Walked the checklist in `context/safety-first.md` §4. Session user only; validation in backend; negative tests for other users and no session; minimal data (one week); no new dependency; no SQL concatenation; unexpected inputs tested (empty, oversized, arrays, injection text, impossible dates)
- [ ] 4.3 Update the MF-55 entry in `context/roadmap.md` to ✅ with its date when archiving
