## Why

Roadmap item **MF-23.1**, the first of the two subtasks of MF-23 (`context/roadmap.md`). A user can choose a menu on `/planner` (MF-43), but cannot see its dishes: `/menu` is still the placeholder of MF-51.1. The weekly flow (`context/decisiones.md` UI-flujo-semanal) needs the chosen menu to become the "current menu" the user cooks from, and `context/producto.md` §4 puts it at `/menu`, with the recipe as a card that unfolds when a dish is pressed (UI-card-receta). The screen is mocked in the design system (`MenuScreen.jsx`); this subtask builds its mobile view, and MF-23.2 the desktop grid with the recipe panel.

**Result:** on a phone you see your week day by day, with its dates, and unfold a recipe.

## What Changes

- **`/menu` shows the active menu** (this week's selection, MF-43.1): a heading "Menú N" with "Semana del 5 de octubre" above it, seven day tabs with the date of each day and a mark on today, and the selected day's dishes under "Comida" and "Cena". Today's tab is selected when the page opens. At every width until MF-23.2 adds the grid.
- **Each dish is a card.** A dish with a recipe unfolds into its times, its ingredients with their amounts (and "opcional" when it is), and its preparation steps. A dish without a recipe says "Sin receta" and does not unfold.
- **A day with no dishes** says "El menú no incluye platos para este día".
- **No active menu:** the page says so and links to `/planner`. **The menu cannot be read:** the page says it could not be loaded.
- **Reads in the existing ports** (AGENTS.md, reuse a port before creating one): `MenuRepository.find(number)` and `RecipeRepository.findByFiles(files)`, in their Postgres and JSON-file adapters. No new port.
- **A use case `activeMenu`**, on `currentSelections` (MF-43.1), `MenuRepository` and `RecipeRepository`, that returns the menu of this week with the date of each day and today's date.
- **Ported from the design system** into the new feature `weekly-menu`: `DayTabs`, `RecipeCard` and the three icons they use.
- **Left out:** the desktop grid and the recipe panel (MF-23.2); next week's menu; the shopping list (MF-24); the dashboard (MF-25).

## Capabilities

### New Capabilities
- `weekly-menu`: what `/menu` shows to a signed-in user (the active menu by day, the recipe cards, the empty and failure states) and its negative access cases.

### Modified Capabilities
- `app-shell`: the requirement "Each of the four tabs leads to a page" keeps the placeholder only for `/shopping-list`; `/menu` now shows the weekly menu.

## Impact

- **Code:** `src/application/ports/menu-repository.ts` and `recipe-repository.ts` gain a read method each; their adapters in `src/infrastructure/postgres/` and `src/infrastructure/json-file/`; new `src/application/use-cases/active-menu.ts`; new `src/application/dto/weekly-menu.ts`; a domain function for the dates of the week in `src/domain/selection/week.ts`; `src/app/(app)/menu/page.tsx`; new feature `src/features/weekly-menu/`; `web-container.ts` wires `activeMenu` with `PostgresRecipeRepository`; `e2e/menu.spec.ts`.
- **Dependencies:** none new. The icons are inline SVG, as in `nav-icon.tsx`.
- **Database:** no migration. Reads `selection`, `menu`, `meal`, `menu_dish`, `recipe` and `recipe_ingredient`, all with parameterised queries.
- **Decisions relied on:** UI-flujo-semanal, UI-card-receta, UI-design-system, ARQ-modelo-datos (the active menu, "today" in Europe/Madrid behind `Clock`), ARQ-hexagonal and `context/adr/ADR-001-arquitectura-interna.md` §2, §3 and §5, SEG-roles, SEG-sistema-cerrado, SEG-datos-nutricionista. No contradiction. One deviation from the mock, in `design.md`: a dish without a recipe is not a button.
- **Data:** the user's own selection, and the dishes and recipes of that one menu. Recipe text is nutritionist data that SEG-datos-nutricionista allows in the database for this card; it reaches only a signed-in user and never a log. The e2e test uses a fictitious menu and recipe it creates and removes.
- **Abuses and OWASP:**
  - Reading `/menu` without a session (A01, A07): the page checks the session first and redirects to `/login`.
  - Reading another user's menu (A01): the page takes no input; the user comes from the session and the selection is read only for that user (`context/safety-first.md` §2.2).
  - Injection (A03): no user input reaches a query; the menu number and recipe files come from the database and go as parameters.
  - Excessive data exposure (A01): the page receives only the active menu and its recipes, never the 434 recipes.
  - Leaking recipe text (SEG-datos-nutricionista): database errors are reduced to their message by `describeDatabaseError`, without row content.
