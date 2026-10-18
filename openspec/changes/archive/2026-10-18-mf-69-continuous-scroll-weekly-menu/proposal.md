# Proposal: MF-69 Continuous Scroll Weekly Menu on Mobile

## Why

On mobile screens (< 800 px), the `/menu` page currently behaves as an isolated tab interface where users can only view one day at a time, requiring repetitive tab taps to compare or browse through consecutive meals and recipes. Switching to a continuous vertical scroll feed with a sticky day header and scrollspy synchronization provides a seamless browsing experience, anchors the viewport on today's meals upon arrival, and allows instant navigation to any specific weekday via anchor buttons.

## What Changes

- **Continuous Mobile Day Feed**: Render all seven days of the active week sequentially in vertical scroll order on mobile screens (< 800 px), rather than unmounting/swapping day panels.
- **Initial Viewport Anchoring on Today**: When the user opens `/menu` on mobile, automatically scroll the viewport to today's day section (taking into account the sticky navigation bar offset).
- **Scrollspy Synchronization**: Detect the day section currently visible near the top of the viewport (via `IntersectionObserver` or scroll detection) and highlight the corresponding day button in the sticky header.
- **Anchor Day Navigation**: Tapping a day button in the sticky header smoothly scrolls the page to align that day's heading just below the sticky header.
- **Progressive Enhancement / No-JS Resilience**: When JavaScript is disabled, all days remain rendered and readable in vertical order in the DOM.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `weekly-menu`: Changes mobile display requirement from isolated day tabs to a continuous multi-day scroll feed with initial focus on today, scroll-based day detection, and anchor button scrolling.

## Impact

- **Affected Code**: `src/features/weekly-menu/components/weekly-menu.tsx`, `src/features/weekly-menu/components/day-tabs.tsx` (kept, as an in-page navigation), the new hook `src/features/weekly-menu/use-day-scroll.ts`, and their tests (`weekly-menu.test.tsx`, `day-tabs.test.tsx`, `src/app/(signed-in)/menu/page.test.tsx`, `e2e/menu.spec.ts`).
- **Data & APIs**: No domain, database, API, or server action changes. Read-only presentation enhancement.
- **Security & OWASP**:
  - Touches only client-side presentation of already authorized and sanitized menu data.
  - OWASP A01 (Broken Access Control) / A03 (Injection): Preserves existing session validation via `requireUser()` and server-driven `menuWeekPage` use case. No user input or URL query params are interpreted for DOM script injection.
  - Decision citations: Cites `UI-card-receta` and `ARQ-hexagonal` from `context/decisiones.md`.
