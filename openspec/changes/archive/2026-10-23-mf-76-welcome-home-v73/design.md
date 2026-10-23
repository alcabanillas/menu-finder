# Design: MF-76 home without a session at design system v73

## Context

Source of the design: the "Menu Finder Design System" artifact (<https://claude.ai/code/artifact/2b9c8f4b-b06b-4b2d-a22a-221b23edc61a>), version `1792687168-5ad7`, card "Bienvenida" (`project/components/Bienvenida/preview.html`) and `project/ui_kits/app/WelcomeScreen.jsx`, row v73 of `project/implementacion.md`. Its pieces come from `MenuCandidateCard.jsx`, `RecipeCard.jsx` and `Checkbox.jsx` of the same version; their sample data from `ui_kits/app/data.js`. Version `1792741404-457d` (v79) later changed only the sentence of the closing block (row v78).

Today `/` renders `<AppShell><WelcomeScreen /></AppShell>` for a visitor (`src/app/page.tsx`). `WelcomeScreen` lives in `features/welcome` and is static. The pieces the new design shows already exist in other features: the chips (`RestrictionChipList`) and the card (`MenuCandidateCard`) in `features/menu-planner`, the recipe card in `features/weekly-menu`, the box of a shopping item in `features/shopping-list`. ADR-001 §3 forbids a feature to import another feature; `app/` may import any.

## Goals / Non-Goals

**Goals:**
- The page of `WelcomeScreen.jsx`, with the real components of Buscar, Menú and Compra in its sample pieces, so that the home and the app look the same and change together.
- The pieces are inert: not focusable, not in the accessibility tree, no request leaves them.

**Non-Goals:**
- No change to the shell's variant for a visitor (its header and its own "Acceder" stay).
- No sample-data generator, no reading of the catalogue at run time: the samples are constants.

## Decisions

### D1. The welcome takes the sample pieces as slots; `app/` builds them

`WelcomeScreen` gets four props, `ReactNode` each: `search` (request, chips and card), `week`, `recipe` and `shopping`. A new `src/app/_welcome/sample-pieces.tsx` builds them from constants with `RestrictionChipList`, `MenuCandidateCard`, `RecipeCard` and the shopping `Checkbox`, and `page.tsx` passes them. It is the pattern `DashboardLayout` already uses for its blocks.

*Alternatives:* (a) move the four components to `shared/ui` — `MenuCandidateCard` depends on the view types of `features/menu-planner/search-view.ts` and `RecipeCard` on `RecipeBody` and `MenuIcon`, so half of two features would move up for one page; (b) redraw the pieces inside `features/welcome` — two copies of each that drift apart, the opposite of "la tarjeta es la misma en Buscar y en la home".

The six day cards of "La semana, de un vistazo" have no component in the app (Menú shows a day at a time), so they stay local to `features/welcome` and take their dishes from a prop: they are not a second copy of anything.

### D2. Inert, not only `aria-hidden`

Each sample piece is wrapped in an element with `aria-hidden="true"` and `inert`. `aria-hidden` alone leaves the recipe card's header button focusable, a hidden focusable control (axe `aria-hidden-focus`). `inert` takes the subtree out of the tab order, of the accessibility tree and of pointer events, so the recipe card cannot be folded and the card has no buttons anyway (no `choice`, no `onViewWeek`). The visible text of each feature (number, heading, paragraph) stays outside the inert panel, as in the design.

### D3. The recipe card can start open

`RecipeCard` gets `defaultOpen?: boolean` (default `false`), the initial value of its state, like `defaultExpanded` in the design system's `RecipeCard.jsx`. The design also draws an eyebrow ("Lunes · Comida") above the name; the app's card has none today, so the sample shows it without one rather than adding a prop only the home would use. *Alternative:* add `eyebrow` — rejected for now; noted for the visual comparison in `verify`.

### D4. Sample data: invented dishes, checked against the local catalogue

The constants live in `src/app/_welcome/sample-data.ts`; `sample-pieces.tsx` builds the pieces from them. The dishes of the design's `data.js` that appear in the local catalogue are replaced (for example "Crema de calabacín" and "Merluza al horno" are in `data/`). `scripts/welcome/check-sample-dishes.ts` reads `data/menu-platos.json` and `data/recetas.json` when they exist and fails, naming the dish, if a sample dish or recipe title matches one of them (case-insensitive, whole name). It runs by hand (`pnpm welcome:check-samples`): CI has no `data/`. "Menú 14" stays: menus are numbered 1 to 36 and the number says nothing of their content; the evidence lines under it are invented.

### D5. Layout at the app's breakpoints

The design's container queries at 640, 800 and 1100 px map to the app's: gutter and paddings at 640 px, the two-column cover and the alternating features at 800 px (UI-punto-de-corte), the 64 px heading at 1100 px. The page keeps the 1440 px maximum width of the other pages. Classes are literal Tailwind; the type sizes the design hard-codes (38/48/56/64 px heading, 26/32 px feature headings, 17 px lead) are written as arbitrary values, as the dashboard heading already does.

### D6. The evidence line drops the minus

`EvidenceItem` of `menu-candidate-card.tsx` stops rendering the minus icon before an `exclude` term; colour and the screen reader text ("excluido: …") stay. The chips keep their minus: they are another component and the design keeps it there.

## Risks / Trade-offs

- [The minus was the non-colour cue of an excluded term inside a mixed unit (WCAG 1.4.1)] → The design system removes it; the screen reader text keeps "excluido" and a week-wide exclusion is also told by "no aparece en la semana". The trade-off is stated in the proposal for the author to see.
- [`inert` support] → Supported by every evergreen browser since 2023; React 19 passes it as a boolean attribute.
- [A sample dish later added to the catalogue] → The check script is re-run when the catalogue is ingested again; it is in the runbook of `tasks.md`.
- [The design draws the closing "Acceder" as a primary button and the cover one as warm] → Followed as drawn: two links styled by `buttonClasses`.
