# Tasks

Each test was written first and seen failing before its code (PROC-tdd).

## 1. Design system copy

- [x] 1.1 `design-system/VERSION` to `1792604876-7119`; `pnpm ds:tokens` regenerates `src/app/theme.css` (only its version header changes)

## 2. One question at a time (menu-planner)

- [x] 2.1 Test: a new search closes the question of "Al azar"
- [x] 2.2 Test: a new search closes the question of a card, although the same menu comes back
- [x] 2.3 Test: asking from another card closes the first question
- [x] 2.4 `useMenuChoice.dismiss` clears `ask`; `select` calls `dismiss` (D1)

## 3. Copy and type (menu-planner)

- [x] 3.1 Test: the box reads "Busca otra cosa…" once a search has been sent, and keeps its accessible name
- [x] 3.2 `SearchBox` takes `searched`; `PlannerSearch` passes it
- [x] 3.3 Test: the exclusions-only line is `text-sm`, `text-text-muted`, `max-w-[70ch]`
- [x] 3.4 The line in `PlannerResults` takes those classes

## 4. Modal panels (menu-planner, weekly-menu, home)

- [x] 4.1 Test: the week preview is `aria-modal`, against the right edge (`right-0`, no 1440 px), its backdrop shows from 800 px below the header, its body has a thin scroll bar, and the page does not scroll while it is open
- [x] 4.2 `WeekPreviewPanel` with those classes; `closeOnEscape` and `lockPageScroll` move to `shared/ui/modal-panel.ts` (D2, D3, D4)
- [x] 4.3 Test: the recipe panel is a 400 px modal at `top-16 right-0`, closes with Escape, ✕ and the backdrop, and locks the page scroll
- [x] 4.4 Test: in Menú and Hoy the panel lies on the right wherever the dish is (replaces "the side away from the dish")
- [x] 4.5 `RecipePanel` modal; `side`, `PanelSide` and `sideAwayFrom` removed from `RecipePanel`, `WeeklyMenu` and `TodayMeals`

## 5. One breakpoint (app-shell, weekly-menu, menu-planner)

- [x] 5.1 Test: the shell switches its navigation and its header height at `min-[800px]:`, with no `sm:` left
- [x] 5.2 Tests: the sticky day bar of Menú, its scroll margins and the search row of Buscar switch at `min-[800px]:`
- [x] 5.3 `AppShell`, `WeeklyMenu` and `PlannerSearch` move from `sm:` to `min-[800px]:` (D5); the gutter stays at 640 px

## 6. Verification

- [x] 6.1 By eye at 390, 700 and 1440 px: the panels flush with the right edge, their footers visible, one scroll bar; the shell in phone mode at 700 px
- [x] 6.2 `pnpm typecheck`, and `pnpm exec eslint` on the touched files without `import/no-cycle`
- [x] 6.3 `pnpm test:coverage` before `gh pr create`

## Workflow follow-up

- Mark row v68 of `project/implementacion.md` in the design system artifact as `implementado`, with the PR.
- Archive the change once the PR is merged.
