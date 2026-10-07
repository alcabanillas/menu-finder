## 1. Contract (design D7, step 1)

- [x] 1.1 RED: `src/domain/selection/local-date.test.ts`: `mondayOf` for every day of the week 2026-10-05 to 2026-10-11 gives 2026-10-05; across a month and a year end (2026-12-31 → 2026-12-28; 2027-01-03 → 2026-12-28); across the daylight-saving change (2026-10-25 → 2026-10-19); `addDays` and `isMonday`; see them fail
- [x] 1.2 GREEN: `local-date.ts` (design D5)
- [x] 1.3 The types `Selection` and `CurrentSelections` (`src/domain/selection/selection.ts`), the ports `SelectionRepository` and `Clock` exactly as in design D6; `pnpm typecheck` and ESLint pass. Not committed: knip refuses ports nobody uses yet, so the contract goes to both tracks as a patch, and the first commit of code is the integration (4.1)

## 2. Core, in parallel with 3 (design D7, step 2)

- [x] 2.1 RED: `week.test.ts` for `startsOnFor`: "Choosing in a week with no menu", "Choosing on a Monday with no menu", "Choosing while a menu is active"; and for `currentOf`: "Only this week's menu", "Next week's menu already chosen", "Next week chosen, nothing this week", "A menu ends on its Sunday", "A user who never chose"; see them fail
- [x] 2.2 GREEN: `week.ts`
- [x] 2.3 RED: `select-menu.test.ts`, against an in-memory `SelectionRepository` and a fixed `Clock`: the three start-date scenarios through the use case; "Changing next week's menu" and "Past selections are kept"; "Not a positive integer" with `"12abc"`, `0`, `-3`, `1.5`, `"1.5"` and `undefined` (nothing reaches `replace`); "A menu that does not exist" (`replace` returns `unknown-menu`); a read or write failure gives `failed`; "Another user's selection does not move the start date" (the fake holds rows of two users); see them fail
- [x] 2.4 GREEN: `select-menu.ts` (design D6)
- [x] 2.5 RED: `current-selections.test.ts`: it returns what `currentOf` gives for the user's rows from this Monday; "Another user's selections are invisible"; a read failure gives `failed`; see them fail
- [x] 2.6 GREEN: `current-selections.ts`. Coverage of `src/domain/selection/` and the two use cases is 100 %

## 3. Infrastructure, in parallel with 2 (design D7, step 2)

- [x] 3.1 RED: `src/infrastructure/clock/system-clock.test.ts`: "Today is the date in Madrid" (2026-10-11T22:30:00Z gives 2026-10-12) and a summer instant (2026-07-01T22:30:00Z gives 2026-07-02); see them fail
- [x] 3.2 GREEN: `system-clock.ts` (design D2)
- [x] 3.3 RED: `postgres-selection-repository.test.ts` against the `test` branch (`createMigratedTestDatabase`, a user row and menus 3, 12 and 20 inserted in `beforeEach`): `replace` stores and returns the selection with its `startsOn` as `YYYY-MM-DD`; `listFrom` returns only rows from that date on, ordered, and only the given user's; replacing the same `startsOn` leaves one row with a new id and keeps other dates; menu 999 gives `unknown-menu` and stores nothing; "The stored start date is always a Monday" (a direct `INSERT` with a Tuesday fails); "Re-ingesting the menus" (`PostgresMenuRepository.saveAll` with menu 3 again succeeds and the selection still exists); deleting the user deletes their selections; see them fail
- [x] 3.4 GREEN: `postgres/migrations/005-selection.sql` (design D1, D3) and `postgres-selection-repository.ts` (design D2, D4); the migration runner test still passes

## 4. Integration (design D7, step 3)

- [x] 4.1 Merge the two tracks; `selectMenu` and `currentSelections` in `web-container.ts` with `PostgresSelectionRepository` on the existing pool and `SystemClock`; extend `web-container.test.ts` so both are exposed and no variable is read before the first call
- [x] 4.2 `pnpm typecheck`, `pnpm lint` (architecture rules, knip) and `pnpm test:run` pass; `pnpm test:coverage` meets the thresholds
- [ ] 4.3 Apply `005-selection.sql` to the `dev` branch with `pnpm ingest migrate` (`context/decisiones.md` OPS-ramas-bd); not to `production`

## 5. Close

- [ ] 5.1 Before `archive`: go through the checklist of `context/safety-first.md` §4 and record the result here
- [ ] 5.2 At archive: update `context/decisiones.md` ARQ-modelo-datos (`Selection` gains `id` and `startsOn`; active menu by date, current shopping list by next Monday) and mark MF-43.1 done in `context/roadmap.md`
