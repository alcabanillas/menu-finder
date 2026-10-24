# Tasks: MF-74 `/menu` for a week without a menu, at design system version v64

Every group: the test of each scenario is written first and seen failing (PROC-tdd), then the code. During apply, no `pnpm lint`; run `pnpm typecheck` and the tests of the files touched (`AGENTS.md`).

## 1. Design system copy

- [x] 1.1 `design-system/VERSION` already holds `1792450792-6aa6` (written before this change was proposed); check that `design-system/tokens.json` has the same content as `project/tokens.json` of the artifact (it did on 2026-10-20: only the final newline differs), run `pnpm ds:tokens` and `pnpm test:run scripts/design-system`, and verify `src/app/theme.css` has no diff except its version comment.
- [x] 1.2 Update the version quoted in the header comment of `src/app/theme.css` and in the headers of the files this change touches (`empty-menu.tsx`, `week-nav.tsx`, `week-header.tsx`, the notice), and in `design-system/README.md` if it names a version; verify with a search for `1792443153-9554` and `1792255497-a1ff` that no touched file still cites them as current.

## 2. The closed week, from the rule of Buscar (spec: "A closed week")

- [x] 2.1 Tests in `menu-week-page.test.ts`: `lockedBy` is `{ menuNumber: 31, startsOn: <next Monday> }` when the current week is shown with no selection and next week has menu 31; it is `null` when next week has none, when a past week is shown, when next week is shown, and when the shown week has a menu of its own; the selections are read once (`listFrom` called one time); seen failing.
- [x] 2.2 `menuWeekPage` reads the selections once, picks the shown week's and asks `isLocked` for the lock; the tests pass.

## 3. One notice for Hoy and `/menu` (specs: "A week without a menu says what the user can do", "A closed week", "The next week without a menu")

- [x] 3.1 Move `no-menu-notice.tsx` and its test from `features/dashboard/components/` to `shared/ui/` (`git mv`) and update the import in `app/page.tsx`; the tests of Hoy still pass.
- [x] 3.2 Tests in `shared/ui/no-menu-notice.test.tsx`, one per case: `past` is grey, has "No se eligió menú para esta semana" and "Las semanas pasadas no se pueden cambiar." and no link; `open` is olive with "Esta semana aún no tiene menú" and the link "Elegir menú para esta semana" to `/planner?week=current`; `locked` is grey with "Esta semana no tiene menú", "Menú 31" and the link "Ver el menú de la semana que viene" to `/menu?startsOn=2026-10-19`, and no link to choose; `future` is olive with "La semana que viene aún no tiene menú" and the link "Elegir menú para el 19 oct" to `/planner?week=next`; every case has `role="status"`; a `className` reaches the root; seen failing.
- [x] 3.3 Add the `past` and `future` cases and the grey colour to the notice; the tests pass.

## 4. `/menu` shows the notice and nothing else (specs: "The page without a menu to show", "A week without menu shows the empty state…")

- [x] 4.1 Tests: `empty-menu.test.tsx` — the heading is "Semana sin menú", the eyebrow "Semana del 5 de octubre" stays, there is one `role="status"` and no card for any day (no "Lunes", no "Domingo"), and the notice is at most 760 px from 800 px and has no `mx-auto`; the failed page keeps "Menú" and its message; `menu/page.test.tsx` — each of the four cases reaches the page (past, this week open, this week closed by menu 31, next week), the links hold only server dates (a `startsOn` of the request that is not a Monday of the window changes nothing), and the page without a session still redirects; seen failing.
- [x] 4.2 `EmptyMenu` takes the notice; remove `GhostDays` and the grey card; `app/(signed-in)/menu/page.tsx` builds the case from `navigation.status`, `lockedBy` and `navigation.shown`; the tests pass.

## 5. One width for the page (spec: "The page has one maximum width")

- [x] 5.1 Tests: `page.test.tsx` — the page wraps the menu, the empty week and the failure in the same box (centred, `max-w-[1440px]` from 800 px); `weekly-menu.test.tsx` no longer expects the box on `WeeklyMenu`; seen failing.
- [x] 5.2 Move the box from `WeeklyMenu` to `app/(signed-in)/menu/page.tsx`; the tests pass.

## 6. The week controls (spec: "The page moves between weeks from its header")

- [x] 6.1 Check `week-nav.test.tsx` against the scenarios: "Esta semana" shows on a past week and on next week and not on the current one; the next control is disabled on next week. Add the tests that are missing; they pass on the current code (no production change).

## 7. Verification

- [x] 7.1 Run `pnpm typecheck`, the tests of the touched folders and `pnpm test:run` for `src/app`, `src/features/weekly-menu`, `src/features/dashboard`, `src/shared` and `src/application/use-cases/menu`.
- [x] 7.2 Look at the four cases by eye at 390 px and at 1440 px, and at 1920 px for the width, with and without a menu: title and notice start where the header's content starts; the notice is at most 760 px and left-aligned from 800 px; no day cards; the buttons lead to Buscar with that week selected, or to `/menu` on next week. Report what was seen and with which data (canned or real).
- [x] 7.3 Run `pnpm test:coverage` before the PR (`AGENTS.md`): done on 2026-10-20, passes; the author said on 2026-10-21 the PR does not raise `"version"`.

## 8. Close

- [x] 8.1 In the design system's `project/implementacion.md`, set the two "Menú" rows to `implementado` (or `parcial`, with what is missing) with the ticket MF-74 and the PR, and publish the artifact.
- [x] 8.2 Add MF-74 to `context/roadmap.md` (ID and ~2 h estimate confirmed by the author on 2026-10-21, done); after the merge, archive this change (checklist `context/seguridad/safety-first.md` §4).
