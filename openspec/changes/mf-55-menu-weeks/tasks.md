## 1. Week resolution (domain, pure)

- [ ] 1.1 RED: test `resolveStartsOn` returns the requested Monday when it is inside `[today − 70 days, today + 7 days]`, including both boundary Mondays (scenarios "Going back", "Going forward", boundary Mondays)
- [ ] 1.2 RED: test `resolveStartsOn` returns the current Monday for every negative scenario of "The startsOn parameter is validated": `not-a-date`, `2026/10/05`, `05-10-2026`, `2026-10-5`, `2026-02-30`, `2026-13-01`, leading/trailing space, a Wednesday, an array (repeated parameter), an oversized string, an injection-shaped string, `undefined`
- [ ] 1.3 RED: test that the same invalid inputs never reach the parser: an oversized value is rejected by length before `Date` is called (spy on the parser)
- [ ] 1.4 RED: test a week older than 70 days and a week beyond next week fall back to the current Monday
- [ ] 1.5 GREEN: implement `resolveStartsOn(raw: unknown, today: LocalDate)` in `src/domain/selection/` with the six steps of `design.md` D1, in that order
- [ ] 1.6 REFACTOR: name the window limits once, as constants

## 2. Look-back read (selection and menu)

- [ ] 2.1 RED: integration test in `postgres-selection-repository.test.ts`: `listFrom(user, monday − 70)` returns selections in window and future ones, ordered; excludes eleven-weeks-back; excludes another user's selection (scenarios of "Past selections")
- [ ] 2.2 RED: unit test for empty user id → read fails without data (negative scenario)
- [ ] 2.3 GREEN: call `listFrom` with the 10-week lower bound from the new use case; no SQL change if 2.1 passes already, otherwise adjust the test first
- [ ] 2.4 RED: use-case test `weekMenu` calls `menus.find` once with the menu number of the requested week and never `list` (scenario "One menu is read")
- [ ] 2.5 RED: use-case test `weekMenu` returns a failure when the selection's menu is missing (scenario "Selection whose menu is missing")
- [ ] 2.6 GREEN: implement `weekMenu({ userId, startsOn })` in `src/application/use-cases/`, reusing `menuWeek`

## 3. Page and composition

- [ ] 3.1 RED: component test for the header controls: previous enabled on an empty week, disabled at the tenth week back; next disabled at next week; "this week" present only when not on the current week (scenarios of navigation)
- [ ] 3.2 RED: component test for the empty state on a past week: the week-aware copy and the `/planner` link; the current-week copy unchanged
- [ ] 3.3 GREEN: header navigation and empty-state variant in `src/features/weekly-menu/`, receiving data through props
- [ ] 3.4 RED → GREEN: `app/(signed-in)/menu/page.tsx` awaits `searchParams`, passes `startsOn` to `resolveStartsOn`, then `webContainer().weekMenu`; the user id still comes only from `requireUser()`. Update the page comment that says the URL does not reach the use case
- [ ] 3.6 RED: page-level test that a session-less request is redirected before any `startsOn` is read
- [ ] 3.5 RED → GREEN: E2E (Playwright) for a signed-in user: go back one week, see the empty message, return to this week; a request without session is redirected (scenarios "Request without a session", "Another user's selection")

## 4. Verification and close

- [ ] 4.1 Run `pnpm lint` (ESLint dependency rules) and `pnpm test` (Vitest) green
- [ ] 4.2 Walk the checklist in `context/safety-first.md` §4 and record the result in the archive notes
- [ ] 4.3 Update the MF-55 entry in `context/roadmap.md` to ✅ with its date when archiving
