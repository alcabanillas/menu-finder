# Proposal: MF-73 `/planner` at design system version v62

Roadmap item: **MF-73** (`context/roadmap.md`; the ID is provisional, to be confirmed by the author, who also has to add the item). One change, no subtasks (decided by the author on 2026-10-19, although the estimate is above 2 h).

**Order:** this change modifies the requirements "No menu fits" and "Candidate cards with evidence and a choose button" as `mf-61-ranking-explanation` leaves them. `mf-61-ranking-explanation` has to be archived first, or the archive of this change would restore the older text of both.

## Why

The design system moved from version `1792255497-a1ff` (v48) to `1792443153-9554` (v62). Its registry `project/implementacion.md` (audit of 2026-10-19) lists what Buscar still lacks: the "Prueba con" row, the full-width strip "Lo que has pedido" and two result columns, the no-results state with "Editar mi búsqueda", "Al azar" as a suggestion instead of a loose button, "Ver semana" on each card, and evidence lines on white. The tokens did not change (`tokens.json` is identical), so the copy only needs its `VERSION`.

## What Changes

- **Design system copy:** `design-system/VERSION` becomes `1792443153-9554` (v62). `design-system/tokens.json` is not touched: it is identical to the artifact's.
- **Suggestions ("Prueba con"):** before the first search, a row under the search box with the chip "Al azar" and four requests taken at random from a fixed list. The "Elegir uno al azar" button disappears from both layouts. "Al azar" keeps its behaviour: it chooses a random menu for the selected week, and asks first when that week has a menu.
- **Results layout:** "Lo que has pedido" is a full-width strip above the results (no 300 px side column), and the cards are in two columns from a 1100 px container.
- **No menu fits:** besides the heading, the sentence "Quita alguna condición o dila de otra forma.", the button "Editar mi búsqueda", a tip and "O prueba con algo que suele funcionar" with the same chips ("Al azar" first). "Editar mi búsqueda" puts the exact request of the user back in the search box and focuses it; it never rewrites the request.
- **"Ver semana" on each card:** a secondary button that opens a panel with the week of that menu, without leaving Buscar or losing the chips and the ranking. Bottom sheet with a backdrop below 800 px, side panel (right, below the 64 px header, 400 px) from 800 px. It shows the days with their colour bar and the dish names of lunch and dinner, the dishes that are evidence marked ✓ or ≈ with their terms, and a fixed footer with the choose button (and the confirmation when it replaces a menu). Escape, ✕ and, on a phone, the backdrop close it, and the focus returns to the card's button.
- **Evidence lines:** a group that mixes include and exclude loses its ochre background; its terms are on white, each in its colour (`text-include`, `text-exclude`).
- **Not touched:** `WelcomeScreen` (the production one of MF-25 stays; the "Home sin sesión" of the design system is a draft), the "Ver semana" link of the done message under the selector (it goes to `/menu` on the chosen week; the mock keeps it), and the search box placeholder "Busca otra cosa…" after a search, which v62 adds and the author did not ask for.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `menu-planner`: "Choosing a random menu" (the button becomes the chip "Al azar"), "No menu fits" and "Candidate cards with evidence and a choose button" (new button, mixed groups on white); new requirements "Suggestions to try", "Layout of the results", "Editing the last request", "Week preview of a card", "The week preview needs a session and trusts only the menu".

## Impact

- **UI (`src/features/menu-planner/`):** `random-button.tsx` becomes a chip; new suggestions row, strip and week preview panel; `menu-candidate-card.tsx`, `planner-results.tsx`, `planner-search.tsx` and `search-view.ts` change. The panel's Escape and focus handling follows `weekly-menu/components/recipe-panel.tsx`.
- **Application:** a new use case `menuPreview` reads a menu through the existing `MenuRepository.find`; no new port (`AGENTS.md`, "reuse a port before creating one"). A new server action for it in `app/(signed-in)/planner/actions.ts`.
- **Data touched:** the stored menus (dish names only, no recipes, no dates) and the user's own request text, which the search state now returns so that it can be put back in the box. Neither reaches Sentry or logs.
- **Abuses and OWASP:** A01 (the preview is a public POST endpoint: session first, menu number validated, same user-independent catalogue) and A04 (nothing new is stored; the preview is a read). The preview has its negative scenarios (no session, invalid or unknown menu, failing database).

## Decisions it relies on

- **UI-design-system:** the design system is the visual source of truth; the copy of `VERSION` is refreshed in this change (`design-system/README.md`).
- **UI-planner-buscador:** chips only for guidance, top 5, no LLM explanation.
- **SEG-sistema-cerrado:** no anonymous user; every action checks the session.
- **BUS-superficie-consulta (b):** a loose exclusion is a lexical filter; its line stays "no aparece en la semana".
