# Design: MF-73 `/planner` at design system version v62

Source of the design: artifact «Menu Finder Design System», version `1792443153-9554` (v62): `project/implementacion.md`, `project/ui_kits/app/PlannerScreen.jsx` (CSS block `PLAN_CSS`, `WeekPreviewPanel`, `PlannerScreen`) and `project/components/recipe/MenuCandidateCard.jsx` (`onViewWeek`, `viewing`). See `proposal.md` for the motivation and the order with `mf-61-ranking-explanation`.

## Context

- `PlannerSearch` (client) owns the search form, the choose form and `useMenuChoice`; `ResultsArea` puts the chips in a 300 px column beside the cards from an 800 px container (`planner-search.tsx`). `RandomButton` renders two copies, one per width.
- The search state (`PlannerSearchState`, `ranking`) holds the chips and cards, not the text the user wrote. The `request` field is uncontrolled in `SearchBox`.
- `MenuRepository.find(number)` returns a stored menu; `menuWeekPage` already uses it, but only for a menu the user selected, with dates and recipes. Nothing reads a menu by number for a menu that is not selected.
- The recipe panel of `/menu` (`weekly-menu/components/recipe-panel.tsx`) is the model of the new panel: a dialog that takes the focus, closes with Escape and leaves the page usable.
- `main` of the shell is the `@container`; the planner uses `@min-[800px]` and `@min-[1100px]` against it.

## Goals / Non-Goals

**Goals:** everything the registry marks as `diseñado` or `parcial` for Buscar, with the behaviour of the mock; keep the search and the choice working without JavaScript where they did.

**Non-Goals:** `WelcomeScreen` (draft); the placeholder "Busca otra cosa…" after a search; the "Ver semana" link of the done message (it stays, and goes to `/menu`); recipes in the preview; any change to the search, its ranking or `tokens.json`.

## Decisions

**D1. The preview is read on demand through the existing `MenuRepository`.** A use case `menuPreview` (`application/use-cases/menu/menu-preview.ts`) validates the number with `positiveIntegerInput`, calls `menus.find`, and returns `{ menuNumber, days: [{ day, lunch: string[], dinner: string[] }] }`: names only, Monday to Sunday. No new port: `find` already is the boundary (`AGENTS.md`, "reuse a port before creating one"). A server action `previewMenuAction` in `app/(signed-in)/planner/actions.ts` checks the session first (`requireUser`), reads one value and returns a state `{ status: 'ready' | 'failed', … }` with the two messages of the spec. *Alternative:* put the five weeks in the search answer. It makes the panel instant and needs no new action, but it reads five menus on every search, including the ones nobody opens, and grows the state the page keeps. *Alternative:* reuse `menuWeekPage`: it needs a selection, dates and recipes.

**D2. The marks use the dish, not its name.** `EvidenceLine` gets `dish: { day, meal, name } | null` (it already builds `where` from them). The panel marks the dishes whose `(day, meal, name)` equals a line's dish, with ✓ for `met` and ≈ for `similar` and the line's terms joined by " y " (`sameDish`) or " o " (`anyOf`). The mock matches by name only, which would mark a second dish with the same name on another day. A unit with no dish (a loose exclusion) marks nothing.

**D3. State of the preview in a hook.** `useWeekPreview` (feature) holds `{ menu, trigger }`, loads through `previewMenuAction` inside `useTransition`, keeps a loaded menu for the rest of the page's life, and on close returns the focus to the `trigger` (the card's button) after the dialog unmounts, as `weekly-menu` does. Opening another card replaces the open one. A new search closes the preview.

**D4. One confirmation, in one place.** The choose button of the footer is the card's `CardChoice`, so the rules of week and replacement are not duplicated. `ask === menu` shows the question in the footer when the preview of that menu is open, and in the card otherwise (the mock does the same).

**D5. Panel anatomy and layout.** `week-preview-panel.tsx`: header (eyebrow, `h2` "Menú N", ✕), scrolling body, fixed footer. Below 800 px: `fixed inset-x-0 bottom-0`, `max-h-[85%]`, rounded top, `shadow-sheet`, a grab handle and a backdrop that closes on tap. From 800 px: `fixed top-16 right-0 w-[400px]`, no backdrop, `shadow-raised`, `border-l`. The backdrop and the sheet are hidden or reshaped with container classes, as `RecipePanel` does. `role="dialog"` with `aria-labelledby` on the heading, non-modal at every width like the recipe panel (an `aria-modal` that depends on the width cannot be written in CSS). The panel renders as a sibling of the results, from `PlannerSearch`, and its backdrop and sheet use the container classes of the page (checked at 390 and 1280 px: the fixed panel is placed against the viewport). Day bars come from `weekly-menu`'s `DAY_BARS`; under the Scope Rule it moves to `shared/` now that a second feature uses it (ADR-001 §2).

**D6. Suggestions are chosen on the server and are forms.** The list is a constant in `features/menu-planner/suggestions.ts`: twelve texts, each a non-`withdrawn` query of `evals/retrieval/queries.json`, so each returns menus (a test reads the file and checks it; the mock's list is the model, with its wording where the set has it: "de cuchara", "algo fresquito", "para el invierno", "sin cerdo", "pasta sin queso"). `page.tsx` (server) picks four at random on each request with a pure `pickSuggestions(list, random)` and passes them down, so the HTML the server renders is the one the client hydrates. Each request is its own `<form action={formAction}>` with a submit button `name="request" value="…"`: it posts in the body, works without JavaScript and reuses the search action unchanged. "Al azar" is the old random button in chip form: a submit button of the choose form (`name="random" value="1"`), with `onAsk` when the week has a menu.

**D7. The strip and the columns.** `ResultsArea` becomes a column: the strip (`RestrictionChipList` under the label), then `PlannerResults`. The card list is `grid-cols-1 @min-[1100px]:grid-cols-2 items-start`. The 760 px maximum width stays on the selector and the search row.

**D8. "Editar mi búsqueda".** The `ranking` state carries `request`, the text exactly as the form sent it (before the action's `trim()`); `SearchBox` forwards a ref to its input; the button sets `input.value` from `state.request`, focuses it and moves the caret to the end. It renders only when `request` is not empty. It needs JavaScript; the page without it still shows the suggestions. The text is the user's own and goes to the page only; it is not added to any breadcrumb (`planner-breadcrumbs.ts` keeps not sending the request).

**D9. Evidence on white.** `MIXED_TERMS` (ochre pill) is removed from `menu-candidate-card.tsx`; the terms keep `text-include` and `text-exclude`.

## Risks / Trade-offs

- **A fixed panel inside a container-query box** may be positioned against the container instead of the viewport → check at 390 and 1280 px (task 7.1); if it is, render the panel with viewport classes instead of container ones, as the shell's width is the viewport's.
- **The list of suggestions can drift from the golden set** → a test fails if a suggestion is not a live query of the set.
- **`request` in the state** doubles the text in the page payload (300 characters at most) → accepted; it is the user's own text and is not logged.
- **Two scroll contexts on a phone** (page behind, sheet in front) → the sheet scrolls itself; the backdrop stops the page from taking the tap. Scroll locking of the page is not added.
- **Preview of a menu while the choice runs** → the footer button follows `choosing` like the card's.
- **Dependency on `mf-61-ranking-explanation`** → archive it first (see `proposal.md`).

## Migration Plan

No data or schema changes. Deploy with the next release; to roll back, revert the PR. The version of the app (`package.json`) is asked of the author before opening the PR (`AGENTS.md`).

## Open Questions

- None that change the specs. The ID **MF-73** and the roadmap entry are the author's to confirm.
