# Design: MF-69 Continuous Scroll Weekly Menu on Mobile

## Context

In `src/features/weekly-menu/components/weekly-menu.tsx`, the mobile view (`@min-[800px]:hidden`) currently pairs `DayTabs` with a single `DayPanel`, unmounting the inactive days and requiring explicit tab clicks to view each day. Desktop view (`@min-[800px]:block`) uses `WeekCards` and remains untouched. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Present all seven weekdays of the active menu in a continuous vertical scroll on mobile screens.
- Keep the day selector sticky at the top of the viewport.
- Position the viewport directly at today's day section on initial render.
- Detect the visible day during scrolling via `IntersectionObserver` and highlight its button in the sticky bar.
- Enable clicking any day button in the sticky bar to scroll smoothly to that day's section without clipping beneath the sticky bar.
- Maintain full accessibility: accessible in-page navigation landmarks and `aria-current` indicators.
- Preserve full content readability when JavaScript is disabled.

**Non-Goals:**
- Changes to desktop layout, `WeekCards`, or `RecipePanel`.
- Changes to server actions, use cases, DTOs, or database schema.

## Decisions

### 1. Navigation Semantics: In-page Navigation over Tablist
- **Choice**: Use a `<nav aria-label="Días de la semana">` containing buttons with `aria-current="true"` on the active day, and `<section id={dayId}>` for each day.
- **Why**: W3C accessibility guidelines state that `role="tab"` / `role="tabpanel"` represents mutually exclusive panes where only one pane is visible at a time. In a continuous feed where all days are simultaneously in the DOM and visible via scroll, in-page anchor/scrollspy semantics are the standard and accessible pattern.
- **Alternatives considered**: Retaining `role="tablist"` / `role="tab"`. Rejected because screen readers would announce tabpanels that do not toggle visibility.
- **Component**: `day-tabs.tsx` stays, with its design-system name (`navigation/DayTabs.jsx`), its history and its tests. Only its semantics change: `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, `tabIdOf` and the roving `tabIndex` go; the prop `selected` becomes `active`. The arrow keys, Home, End and the wrap-around stay. A new `DayNav` beside it would copy almost all of its code. Today's dot moves from the mock's `bottom: 5px` to `bottom-px`: with today no longer always the active button, the dot shows often, and at 5 px it touches the day of the month (measured in the browser: the number's box ends at 56.5 px of the 64 px button and the dot starts at 54 px). Chosen by the author in the browser on 2026-10-18; the design system's `DayTabs.jsx` still says 5 px.

### 2. Scrollspy Detection: IntersectionObserver with Top Margin
- **Choice**: An `IntersectionObserver` observing each day's section with a `rootMargin` targeting the top reading area of the viewport (`rootMargin: "-136px 0px -65% 0px"`: the header and the day bar take up to 136 px). The logic lives in the hook `src/features/weekly-menu/use-day-scroll.ts`, next to the feature's other modules, so `WeeklyMenu` stays a short layout.
- **Why**: `IntersectionObserver` runs off the main thread, avoids forced layout reflows during scroll, and handles fast scrolling smoothly.
- **Alternatives considered**: Listening to `window.onscroll` with `getBoundingClientRect()`. Rejected due to performance overhead and scroll jank on low-end mobile devices.

### 3. Click-to-Scroll & Lock
- **Choice**: Clicking a day button calls `element.scrollIntoView({ behavior: 'smooth', block: 'start' })`. The app shell's header is sticky too (`top-0`, 56 px, 64 px from 640 px), so the day bar sits at `top-14 sm:top-16`, as the planner's search box does. Each day section has `scroll-mt-32 sm:scroll-mt-34`: the header plus the bar (64 px buttons and 8 px of padding), 128 px and 136 px. With reduced motion preferred, the scroll is `auto` instead of `smooth`. The last section is at least `100dvh` minus the header and the bar high (`last:min-h-[calc(100dvh-8rem)]`, `8.5rem` from 640 px): otherwise a short last day, such as a Sunday without dishes, cannot reach the top, the page ends with Saturday in the reading band and the bar marks Saturday (seen in the browser on Sunday 2026-10-18). While smooth scrolling is active, observer-driven updates are locked for ~500ms to prevent intermediate button flickering.
- **Why**: Instant smooth scroll without visual noise on intermediate days.
- **Alternatives considered**: Pure URL hash navigation (`window.location.hash = ...`). Rejected because it pollutes browser history and can trigger Next.js router re-renders.

### 4. Initial Scroll to Today
- **Choice**: On mount, if the menu includes today's date, execute an immediate scroll to today's section (`behavior: 'auto'`, to avoid an animation on entry). A past or next week does not scroll, so its heading and the week navigation stay in view.
- **Why**: The user immediately sees today's lunch and dinner, while retaining the ability to scroll up for earlier days or down for later days.
- **Alternatives considered**: SSR anchoring. Not possible without URL hashes or fixed viewport positioning.

## Risks / Trade-offs

- **[Risk] Test environment (jsdom) does not implement IntersectionObserver or scrollIntoView**:
  → *Mitigation*: Provide lightweight mocks in test files (`beforeAll(() => { window.IntersectionObserver = ... })`) and verify that default rendering produces all days in sequence.
- **[Risk] Sticky header obscures section headings after scrolling**:
  → *Mitigation*: Set `scroll-mt` on each day section equal to or greater than the combined height of the sticky header and top padding.
