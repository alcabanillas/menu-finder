## Context

- `currentSelections` (MF-43.1) gives the active menu as a `Selection` (`menuNumber`, `startsOn`), reading only the user's rows from this Monday on; "today" is `Clock.today()` in Europe/Madrid.
- `MenuRepository` has `saveAll` and `list()`; `list()` reads the 36 menus with their meals and dishes. `RecipeRepository` has only `saveAll`. Both have a Postgres adapter and a JSON-file adapter (`data/menu-platos.json`, `data/recetas.json`) used by the CLI.
- The schema already holds everything the card needs (`postgres/migrations/001-search-schema.sql`): `recipe` with `total_min`, `preparation_min`, `cooking_min` and `preparation text[]`, and `recipe_ingredient` with `household_measure`, `quantity numeric`, `unit` and `optional`. A dish without a recipe file points to a `dish:<name>` row with no text; its `MenuDish.recipeFile` is `null`.
- `/menu` is the MF-51.1 placeholder inside the shell. `features/menu-planner/format-monday.ts` writes "lunes 5 de octubre".
- **Mock:** `project/ui_kits/app/MenuScreen.jsx` of the design system "Menu Finder Design System" (https://claude.ai/artifact/6PMHm2JqbG6LvGKmZXduwF), version `1791384225-1eab`, with `components/navigation/DayTabs.jsx`, `components/recipe/RecipeCard.jsx`, `components/recipe/SectionHeader.jsx` and `components/navigation/TopBar.jsx`. Its `tokens.json` is identical to `design-system/tokens.json` (checked on 2026-10-07), so the tokens are not refreshed; the `--day-*` colours of the tabs are already in the theme.

## Goals / Non-Goals

**Goals:**
- The mobile view of the mock, at every width until MF-23.2.
- One query per table for the page: the menu by number and the recipes of its dishes, never the whole catalogue.

**Non-Goals:**
- The grid from 800 px and the recipe panel (MF-23.2), which reuse the DTO and the cards of this change.
- Showing next week's menu, or any menu other than the active one.

## Decisions

### D1. Two read methods on the existing ports
- `MenuRepository.find(number): Promise<Result<WeeklyMenu | null, RepositoryReadError>>`. Postgres: the `list()` query with `WHERE m.menu_number = $3`, through the same `toWeeklyMenus`. JSON file: `list()` and pick by number.
- `RecipeRepository.findByFiles(files: string[]): Promise<Result<Recipe[], RepositoryReadError>>`, only the recipes of those files, ingredients by position. Postgres: two parameterised queries (`recipe` with `file = ANY($1)`, `recipe_ingredient` with `recipe_key = ANY($1)`); `numeric` comes back from `pg` as a string and is converted to `number`, and an empty list makes no query. JSON file: read `recetas.json` and filter.

No new port (AGENTS.md, "reuse a port before creating one"): both read the data those ports already store. Each use case asks only for the methods it calls, as `ingestMenus` already did with `Pick<MenuRepository, 'saveAll'>`: `ingestRecipes` takes `Pick<RecipeRepository, 'saveAll'>`, and `searchMenus` and `selectRandomMenu` take `Pick<MenuRepository, 'list'>`. Otherwise the CLI's `FanOutRepository`, which only saves, and the fixed catalogue of `evaluateSearch` would have to implement reads they never do (found during `apply`). Alternative rejected: `list()` and filter in the use case; it reads the 36 menus with all their dishes on every visit to `/menu`, and there is no read of recipes to filter.

### D2. The use case `activeMenu`
`src/application/use-cases/active-menu.ts`:
```ts
type Deps = {
  selections: SelectionRepository;
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};
activeMenu(deps, { userId }): Promise<Result<MenuWeek | null, { kind: 'failed' }>>
```
It calls `currentSelections` (as `selectRandomMenu` calls `selectMenu`), returns `null` without an active menu, then `menus.find(menuNumber)` and `recipes.findByFiles` with the menu's distinct non-null `recipeFile`s. Any read failure, or a selected menu that `find` does not return, is `failed`. `MenuWeek` = `{ menuNumber, startsOn, today, days }`, with seven days in order, each `{ day, date, meals: { lunch, dinner } }` and each dish `{ name, recipe: RecipeContent | null }`. The dish keeps its recipe only when its `recipeFile` is among the recipes read.

The dates come from a pure function in `src/domain/selection/week.ts`, `weekDates(startsOn): LocalDate[]` (seven dates from the Monday), beside `startsOnFor` and `currentOf`. Building the days from a menu, its recipes and the dates is a pure function in `src/domain/menu/menu-week.ts`, tested with plain values.

### D3. The DTO
`src/application/dto/weekly-menu.ts` declares `WeeklyMenuDto` with the same shape as `MenuWeek`, dates as `YYYY-MM-DD` strings, so `features/` does not import `domain/` (ADR-001 §3), as `selection-summary.ts` does for MF-43.2. The page passes the use case's value as is.

### D4. The page
`src/app/(app)/menu/page.tsx`: `requireUser()` first, then `webContainer().activeMenu({ userId })`, then one of three props for the feature: the menu, "none" or "failed". It does not declare `searchParams`, so nothing from the URL reaches it. The heading is the page's `h1`; the shell already gives the `main` landmark.

### D5. The feature `weekly-menu`
`src/features/weekly-menu/` (the feature name ADR-001 §2 gives for this screen):
- `components/weekly-menu.tsx` (client): the heading ("Semana del 5 de octubre" and "Menú N"), the selected day in state, initialised to `today`, and the day panel. Rendered on the server with today selected, so without JavaScript the page shows today's dishes.
- `components/day-tabs.tsx`: ported from `DayTabs.jsx`, with the ARIA tab pattern the mock lacks: `role="tablist"` with a label, each tab with `aria-selected` and `aria-controls`, roving `tabIndex`, and arrow keys (with Home and End) that move and select. The panel is `role="tabpanel"` labelled by its tab. Today's dot gets a visually hidden "hoy" so it is not colour only.
- `components/recipe-card.tsx`: ported from `RecipeCard.jsx`; the header is a `button` with `aria-expanded` and `aria-controls` only for a dish with a recipe.
- `components/menu-icon.tsx`: the Lucide glyphs `clock`, `chef-hat` and `chevron-down` inline and decorative, following `nav-icon.tsx` (an icon library for three glyphs is not worth a dependency).
- `components/empty-menu.tsx`: "Todavía no has elegido menú para esta semana." and a link "Elegir menú" to `/planner`; and the failure "No se ha podido cargar tu menú.", the text `/planner` already uses.
- `format-date.ts`: "5 de octubre" and "Miércoles 7 de octubre", with `Intl.DateTimeFormat('es-ES', …, timeZone: 'UTC')` as in `format-monday.ts` (MF-43.2 D5). Not shared with `menu-planner`: the formats differ, and the Scope Rule keeps each in its feature.
- `SectionHeader` and `TopBar` are a few lines of markup each, written inline in `weekly-menu.tsx` rather than ported as components; nothing else uses them yet.

Each ported component notes the design-system version it comes from (`1791384225-1eab`), as `button.tsx` does.

### D6. Deviation from the mock: a dish without a recipe is not a button
In `RecipeCard.jsx` a dish without a recipe is still a `button` that does nothing, with `aria-expanded="false"`: a control announced as foldable that never unfolds. Here it is an `article` with the name and "Sin receta". The look is the same.

### D7. End-to-end test with a fictitious menu
`e2e/menu.spec.ts` inserts menu 9002 with two dishes, one pointing to a fictitious recipe with two ingredients and two steps and one without recipe, and a selection of it for the test account starting on this week's Monday in Europe/Madrid. After the tests it deletes the selection, the menu and the recipe rows (MF-49: nothing left behind). It checks the tabs, unfolding the recipe, the page without JavaScript and the redirect without a session.

## Risks / Trade-offs

- [The same day colours and dates must stay right across a daylight-saving change] → dates are `LocalDate` strings moved at midnight UTC (`addDays`), never `Date` in the server's zone.
- [Port methods grow for one screen] → each is a plain read of data the port already owns; MF-23.2, MF-24 and MF-25 read the same way.
- [A menu re-ingested with other dishes changes the active menu's content] → expected: the selection points to a menu number, not to a copy.
- [The JSON-file adapters gain read methods only the web would use] → the port requires them; each is a few lines over a read the file already supports.
