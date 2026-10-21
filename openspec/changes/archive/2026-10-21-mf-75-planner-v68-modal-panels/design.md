# Design: MF-75

## Context

- `/planner` keeps the choice of a menu in `useMenuChoice` (`features/menu-planner/use-menu-choice.ts`): one `ask` state (`null`, `'random'` or a card's menu) and a `dismissedAt` mark that hides the message of the last choice. A new search called `dismiss`, which hid the message but left `ask` set.
- The week preview (`WeekPreviewPanel`) and the recipe panel (`RecipePanel`) were built apart, in MF-73 and MF-23.2: the first non-modal from 800 px with its right edge computed against the 1440 px page box, the second non-modal and placed on the side away from the dish by `sideAwayFrom`.
- The shell (`AppShell`) uses Tailwind's viewport `sm:` (640 px); the pages are under `<main className="@container">` and use container queries at 800 px.

## Goals / Non-Goals

**Goals:** one open question at a time; the v68 copy and type; one modal panel shared by Buscar, Menú and Hoy from 800 px; one breakpoint between phone and desktop.

**Non-Goals:** a focus trap inside the panels (Escape, ✕ and the backdrop close them, and the focus moves to ✕ on open; a full trap is not in any spec); reserving the page scroll bar's gutter when a panel opens; the gutter step at 640 px; the `sm:` of the shopping checklist.

## Decisions

### D1. `dismiss` clears the question too

`dismiss` sets `ask` to `null` besides hiding the message, and `select` (another week) calls it. A search, another week and another question all go through the single `ask` state, so a second question replaces the first by construction. Alternative: one flag per card — rejected, it allows two questions at once, which is the fault.

### D2. One modal panel anatomy, two components

Both panels keep their own component (their headers and bodies differ) and share the same classes: `fixed top-16 right-0 bottom-0 w-[400px]` from 800 px, a backdrop `bg-ink/40` from `top-16`, `aria-modal="true"`. What they share as behaviour — Escape closes, the page does not scroll while the backdrop shows — moves to `shared/ui/modal-panel.ts` (`closeOnEscape`, `lockPageScroll`), because two features use it (ADR-001 §2, Scope Rule). `lockPageScroll` skips a hidden backdrop, so the recipe panel, hidden below 800 px, locks nothing on a phone.

Alternative: one generic `SidePanel` component in `shared/ui/` with slots — rejected for now: two users with different headers and footers, and the shared part is a handful of classes and two effects.

### D3. Right edge of the window, not of the page box

`right-0` against the viewport. The previous `right-[max(0px,calc((100vw-1440px)/2))]` left a gap from 1440 px and could push the footer button out of view.

### D4. Thin scroll bar in the panels

`[scrollbar-width:thin]` on the body of the preview and on the recipe panel. With the page locked, it is the only bar on screen; thin, it does not read as a second page bar.

### D5. The shell switches at 800 px of the window

The shell is outside `<main>`, so it cannot use the container queries of the pages; it uses `min-[800px]:` on the viewport. As `<main>` spans the whole width, both measures differ only by the page scroll bar (about 15 px). The sticky offsets that follow the header height (`top-14` / `top-16`, `scroll-mt-32` / `scroll-mt-34`) switch with the header, on the viewport too.

## Risks / Trade-offs

- **Content shift when a panel opens.** Locking the page removes its scroll bar, so the page behind moves about 15 px. Accepted: reserving the gutter would leave an empty strip beside the panel.
- **800–815 px of window.** With a page scroll bar, the shell is in desktop mode while the pages are still in phone mode. The sticky elements already use the 64 px offset there, so nothing overlaps.
- **Departure from the design system.** v61 draws the desktop panels without a backdrop and the shell does not name its breakpoint; the author carries both changes to the design system (UI-paneles-laterales, UI-punto-de-corte).
