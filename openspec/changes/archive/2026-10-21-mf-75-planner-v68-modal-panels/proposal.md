# Proposal: MF-75 `/planner` at design system v68, modal side panels and one 800 px breakpoint

Roadmap item: **MF-75** (`context/roadmap.md`). One change, no subtasks. The code was written before this change was opened, with its tests first; the change records it so that the specs say what the app does.

## Why

The design system moved from `1792450792-6aa6` (v64) to `1792604876-7119`. Its registry `project/implementacion.md` lists row v68 for `/planner` as `diseñado`: two confirmation questions could be open at once, a new search left an old question open, the "Ver semana" panel stood off the right edge of the window from 1440 px and its footer button could be cut, the box kept its first placeholder after a search, and the line of a request with only exclusions had the size of body text.

Reviewing it by eye showed three more faults the author decided to fix in the same change (2026-10-21):

- **Double scroll bar.** The week preview of Buscar was a non-modal panel from 800 px, so its scroll bar sat beside the page's. The recipe panel of Menú and Hoy, also non-modal, chose its side away from the dish, so the two panels sat in different places.
- **Mixed layout from 640 to 799 px.** The shell switched to its desktop navigation at 640 px of the window and the pages at 800 px of their container, so a tablet in portrait showed the desktop header over the phone layout of the pages.

## What Changes

- **Design system copy:** `design-system/VERSION` becomes `1792604876-7119`. `tokens.json` is identical, so `src/app/theme.css` only changes its version header.
- **One question at a time (v68).** A new search closes the open question, whether it came from a card or from "Al azar", and the message of the last choice. Asking from another card, or selecting another week, closes it too.
- **Placeholder after a search (v68).** Once a search has been sent, the box reads "Busca otra cosa…"; before that it reads "¿Qué te apetece?". The spec line that still said "¿Qué te apetece esta semana?" is corrected.
- **Exclusions-only line (v68).** "Como solo has pedido quitar cosas…" is 14 px, muted and at most 70 characters wide.
- **Modal side panels (UI-paneles-laterales).** From 800 px the week preview of Buscar and the recipe panel of Menú and Hoy are the same modal dialog: 400 px, against the right edge of the window, below the 64 px header, over a dark backdrop that leaves the header clear and closes the panel when tapped, with the page behind not scrolling. The recipe panel no longer picks its side. Below 800 px nothing changes: a bottom sheet for the preview, the recipe in place for Menú and Hoy.
- **One breakpoint (UI-punto-de-corte).** The shell switches to its header navigation and its 64 px header at 800 px of the window, where the pages switch. The sticky offsets tied to the header height (the day bar of Menú, the search row of Buscar) switch with it. The page gutter still grows at 640 px.
- **Not changed:** focus rings already show only with the keyboard (`:focus-visible`), and the ✕ already takes the focus when a panel opens; the fault in row v68 was not reproduced in Chromium, so nothing changes for it.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `menu-planner`: "Searching from a request" (placeholder, a new search closes the question), "Choosing a random menu" and "Choosing a menu from the ranking for the selected week" (one question at a time), "Results of a request with only exclusions" (the line's type), "Layout and closing of the week preview" (modal from 800 px, against the window edge).
- `weekly-menu`: "From 800 px a dish opens its recipe in a panel" is removed and replaced by "From 800 px a dish opens its recipe in a modal panel" and "The recipe panel is modal" (always on the right, no side choice). It is removed rather than modified because its scenario "The panel takes the side away from the dish" no longer holds, and a modified requirement cannot drop a scenario.
- `home`: "The dashboard shows what is on today" (the recipe panel is the modal one of Menú, no side choice).
- `app-shell`: "The navigation adapts to the width" (800 px instead of 640 px).

## Impact

- **UI:** `features/menu-planner` (`use-menu-choice.ts`, `search-box.tsx`, `planner-search.tsx`, `planner-results.tsx`, `week-preview-panel.tsx`), `features/weekly-menu` (`recipe-panel.tsx`, `weekly-menu.tsx`, `today-meals.tsx`), `features/app-shell/components/app-shell.tsx`, and a new `shared/ui/modal-panel.ts` with what both panels share (Escape and the page scroll lock), moved up because two features use it (ADR-001 §2, Scope Rule).
- **Application, domain, infrastructure:** none. No action, port or query changes.
- **Data touched:** none new. The panels show what the pages already read; nothing is stored, logged or sent to Sentry.
- **Abuses and OWASP:** no endpoint or server action is added or changed, so no new surface. A04 (insecure design) is the relevant category for the confirmation fix: a stale question could replace a menu the user no longer sees; closing it on every new search, week or question removes that path. The server still applies the `menu-selection` rules to every choice.

## Decisions it relies on

- **UI-design-system:** the design system is the visual source of truth; `VERSION` is refreshed here.
- **UI-paneles-laterales** and **UI-punto-de-corte** (`context/decisiones.md` §1.3), decided by the author on 2026-10-21. Both depart from the design system, which in v61 draws the desktop panels without a backdrop and does not name a breakpoint for the shell: the author takes the change to the design system.
