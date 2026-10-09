## Why

Roadmap item **MF-56** (`context/roadmap.md`). On a desktop, `/menu` (MF-23.2) and `/shopping-list` (MF-24) look empty and unbalanced: at 1900 px the week table leaves a lot of white around it, the recipe panel covers the columns on the right, and a long shopping category pushes the others down the page. The author has revised the design system's mocks of both screens (UI-design-system), and this change applies them. The author chose one change for the whole item rather than subtasks, because it has no visible checkpoint of its own worth reviewing apart.

**Result:** on a desktop, `/menu` shows the week as one card per day, with the recipe panel on the side away from the dish, and `/shopping-list` shows a sticky index of categories beside the products. Both pages and the shell's header share a 1440 px wide box.

## What Changes

- **`/menu` from 800 px: one card per day instead of the table.** Monday to Saturday, and Sunday only when it has dishes. Each card has the day's colour bar, the weekday and the date ("7 de octubre"); today's card is outlined and tagged "Hoy". Under "Comida" and "Cena", each dish in the same bold ink, with its total time when it has a recipe; a meal with no dishes is left out; a day with no dishes says so. A dish with a recipe opens it in the panel, as now. The table and its dashes go.
- **The recipe panel takes the side of the page away from the dish**, measured from where the dish sits on the screen, since a card grid has no fixed column per day.
- **`/shopping-list` from 800 px: a sticky category index on the left.** Each category of the current view with its "marcar todos" control (with its count) and a link to the category. The products on the right, each category headed by its name and its count, without its own "Marcar todos" row (the index has it); two columns of products per category from 1100 px. The progress and the "Todo / Por comprar" filter sit above, over a hairline.
- **Below 800 px nothing changes** on either page.
- **The shell's header, `/menu` and `/shopping-list` share a box at most 1440 px wide** with 32 px gutters, so the wordmark and the content start on the same line (the mock's `.mf-top__in` and `.mf-page--wide`). It was 1200 px.
- **Left out:** the shopping badge of the navigation (MF-54); any change to the data either page reads; `/planner` and `/`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `weekly-menu`: from 800 px the week is shown as day cards instead of a table; the panel's side follows the dish's position on the screen.
- `shopping-checklist`: from 800 px the categories are listed in an index with their tick-all controls and links, and each category's heading shows its count.

## Impact

- **Code:** `src/features/weekly-menu/` (the week table is replaced by a grid of day cards; the panel's side and its edge follow the 1440 px box), `src/features/shopping-list/` (the checklist's desktop layout and a new category index), `src/features/app-shell/components/app-shell.tsx` (the header box widens to 1440 px). `e2e/menu.spec.ts` changes its desktop tests from the table to the cards, and `e2e/shopping-list.spec.ts` gains a desktop viewport. No change to `app/`, `application/`, `domain/` or `infrastructure/`.
- **Dependencies:** none new.
- **Database:** no change; both pages make the same reads.
- **Decisions relied on:** UI-design-system, UI-card-receta, UI-flujo-semanal, and `context/adr/ADR-001-arquitectura-interna.md` §2 (Scope Rule). No contradiction with `context/decisiones.md`. The mock contradicts the design system's own README in one place: its index shortens category names ("Legumbres, semillas, frutos secos" for "Legumbres, semillas, frutos secos y derivados"), while the README says category names are never rewritten. This change keeps the full names; see `design.md`.
- **Data:** the same as MF-23 and MF-24: the user's active menu with its recipes, and the user's current shopping list with its ticks. Nothing new is read, sent or logged.
- **Abuses and OWASP:** no new input, endpoint or query. The category index posts the same tick form as the existing "Marcar todos" control, through the same server action, which checks the session and validates every field as MF-24 specified (A01, A03, A04). The index links are in-page anchors built from the category's position, not from its text (A03). Recipe and item text are rendered by React, which escapes them (A03).
