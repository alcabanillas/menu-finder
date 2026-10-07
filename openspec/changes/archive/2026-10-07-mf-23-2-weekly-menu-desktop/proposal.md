## Why

Roadmap item **MF-23.2**, the second and last subtask of MF-23 (`context/roadmap.md`). MF-23.1 built the mobile view of `/menu`: one day at a time, with recipe cards that unfold. On a desktop screen that view wastes the width and hides the rest of the week; `MenuScreen.jsx` of the design system shows the whole week from 800 px instead, with the recipe in a side panel (UI-card-receta, UI-design-system).

**Result:** on a desktop you see the whole week, open a recipe in the panel and close it with Escape.

## What Changes

- **From 800 px of content width, `/menu` shows the week as a grid:** days in columns, each headed by its weekday and date, with "Comida" and "Cena" as rows and the dish names in the cells. Today's column is highlighted and its header says "hoy". Sunday's column is left out when the menu has no dishes for it. A meal with no dishes shows a dash.
- **A dish with a recipe opens the recipe in a side panel**, over the half of the grid opposite its column. The panel is a dialog named after the dish; it takes the focus when it opens, closes with Escape or its close button, and gives the focus back to the dish. Opening another dish while it is open shows that one. A dish without a recipe is plain text.
- **Below 800 px nothing changes:** the day tabs and the cards of MF-23.1. The day tabs, the cards and the panel are each shown at one width only.
- **The panel shows the recipe as the card does** (times with a dash when unknown, amounts as "1 cucharada · 10 ml", "opcional", numbered steps): the recipe body is shared by the card and the panel. A deviation from the mock, in `design.md`.
- **Left out:** any change to the data the page reads (the `WeeklyMenuDto` of MF-23.1 already has everything); next week's menu; the shopping list (MF-24).

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `weekly-menu`: the day tabs, the selected day and the recipe cards apply below 800 px; from 800 px the page shows the week grid and the recipe panel.

## Impact

- **Code:** only `src/features/weekly-menu/`: a new week grid and recipe panel, the recipe body extracted from `recipe-card.tsx` so the panel reuses it, and `weekly-menu.tsx` showing the mobile view or the grid by container width. `e2e/menu.spec.ts` gains a desktop viewport. No change to `app/`, `application/`, `domain/` or `infrastructure/`.
- **Dependencies:** none new. The close icon (`x`) is one more inline Lucide glyph in `menu-icon.tsx`.
- **Database:** no change; the page makes the same reads as in MF-23.1.
- **Decisions relied on:** UI-card-receta, UI-design-system, UI-flujo-semanal, and `context/adr/ADR-001-arquitectura-interna.md` §2 (Scope Rule) and §5. No contradiction. One deviation from the mock, in `design.md`: the panel shows the recipe exactly as the card does.
- **Data:** the same as MF-23.1, the user's active menu and the recipes of its dishes, already in the page. Nothing new is read, sent or logged.
- **Abuses and OWASP:** the change adds no input, endpoint or query. Access stays as MF-23.1 specified and tested: session first, the user from the session (A01, A07). Recipe text is rendered by React, which escapes it (A03). A dialog that traps or loses the keyboard focus is an accessibility fault, not a security one; the spec covers it with its scenarios.
