# Tasks: MF-69 Continuous Scroll Weekly Menu on Mobile

## 1. Multi-Day Continuous Rendering (TDD)

- [x] 1.1 Write tests in `src/features/weekly-menu/components/weekly-menu.test.tsx` asserting that on mobile (< 800 px) all seven days of the week are rendered sequentially in the DOM with their respective meal sections, and verify the test fails.
- [x] 1.2 Update `WeeklyMenu` in `src/features/weekly-menu/components/weekly-menu.tsx` to render all days in continuous vertical order with unique day IDs and `scroll-mt` offsets, and verify tests pass.

## 2. Sticky Day Navigation & Click-to-Scroll (TDD)

- [x] 2.1 Write tests for the sticky day navigation bar verifying that all day buttons render with their date labels, the active day has `aria-current="true"`, and activating a button invokes scrolling to the target day section, and verify the test fails.
- [x] 2.2 Implement the sticky `DayNav` bar with click-to-scroll functionality and observer lock during programmatic scroll, and verify tests pass.

## 3. Scrollspy & Initial Viewport Anchoring (TDD)

- [x] 3.1 Write tests asserting that on initial render the viewport focuses on today's day section and that scrolling across day thresholds updates the active button in the sticky bar, and verify the test fails.
- [x] 3.2 Implement the initial scroll-to-today behavior on mount and the `IntersectionObserver` scrollspy hook/callback, and verify tests pass.

## 4. Verification & Regression

- [x] 4.1 Run `pnpm test:run src/features/weekly-menu/ src/app/\(signed-in\)/menu/` and verify that all weekly menu tests pass.
- [x] 4.2 Verify accessibility attributes, keyboard focus handling, and no-JS server rendering across the entire `/menu` page: covered by `e2e/menu.spec.ts` (task 5.6); the `e2e` job passed on PR #67.

## 5. Review Fixes (TDD)

- [x] 5.1 Keep `day-tabs.tsx` instead of a new `day-nav.tsx` copy: adapt `day-tabs.test.tsx` to the in-page navigation (landmark, `aria-current`, keyboard, wrap-around), see it fail, then change only the component's roles (design D1).
- [x] 5.2 Test that the day bar sits under the shell's sticky header (`top-14 sm:top-16`) and that day sections leave room for both (`scroll-mt-32 sm:scroll-mt-34`); see them fail, then fix (design D3).
- [x] 5.3 Test that a week without today does not scroll on mount; see it fail, then scroll only when the week holds today (design D4).
- [x] 5.4 Test that reduced motion scrolls with `behavior: 'auto'`; see it fail, then honour `prefers-reduced-motion` (design D3).
- [x] 5.5 Refactor: move the scroll logic of `WeeklyMenu` into `src/features/weekly-menu/use-day-scroll.ts`, read the day of an entry from the days instead of parsing the id, and make `page.test.tsx` check today's mobile section instead of any match.
- [x] 5.7 Test that the last day section is at least the viewport minus the header and the bar high; see it fail, then fix, so a short Sunday reaches the top and the bar marks it (design D3).
- [x] 5.8 Test that today's dot sits 1 px from the bottom of its button (`bottom-px`); see it fail, then move it from the mock's 5 px, which touched the number (design D1).
- [x] 5.6 Update `e2e/menu.spec.ts` to the continuous scroll and run it against the test database: the `e2e` job passed on PR #67.

## Workflow follow-up

- Update `context/roadmap.md` with MF-69.
- Archive the change after verification and approval.

## Security checklist (context/safety-first.md §4)

- Reviewed before archiving: the change is UI only. No new endpoint, input or dependency; the session check stays in `requireUser()` and no query parameter is read.
