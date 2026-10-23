# Proposal: MF-76 home without a session at design system v73, and no minus on excluded evidence terms

Roadmap item: **MF-76** (`context/roadmap.md`). One change, no subtasks.

## Why

The design system moved from `1792604876-7119` to `1792687168-5ad7`. Its registry `project/implementacion.md` lists row v73 of "Home sin sesión (tarjeta Bienvenida)" as `diseñado`: a new home for visitors that replaces the welcome of MF-25 (PR #69). The current welcome only tells what the app does in three short texts; the new one shows it with pieces of the app itself. The same design draws the evidence of an excluded term without the minus ("✓ cerdo · no aparece en la semana"), and the card must be the same in Buscar and in the home.

## What Changes

- **Design system copy:** `design-system/VERSION` becomes `1792741404-457d` (v79). `tokens.json` is identical, so `src/app/theme.css` only changes its version header. The home was first built at `1792687168-5ad7` (v75); row v78 then changed only the sentence of the closing block, which replaced "Menu Finder no inventa menús ni recetas: solo encuentra y ordena los que ya existen."
- **Home without a session (v73, `WelcomeScreen.jsx`):**
  - A green cover: eyebrow "Planificador de menús", heading "Planifica la semana sin darle vueltas", the text "Dile qué te apetece como se lo dirías a alguien de casa. Te enseña los menús de la nutricionista que encajan y el plato que lo demuestra.", the warm link "Acceder" and a line with the colours of the days and "36 menús · recetas con tiempos · compra por categorías".
  - Beside it on a desktop (below it on a phone), a sample search: "de cuchara, sin cerdo y con garbanzos", its three chips and the card of Menú 14 with its evidence, drawn with the real chips and card of Buscar.
  - Three features, each with a number, a heading, a text and a piece of the app in a grey panel, alternating sides on a desktop: "La semana, de un vistazo" (six day cards), "Cada plato, con su receta" (an open recipe card) and "La compra, por categorías" (one category with three boxes).
  - A closing block: "¿Qué os apetece esta semana?", "Escríbelo como te salga y te enseñamos los menús que encajan." and a second "Acceder".
  - The pieces are samples: hidden from screen readers and not operable. Their dishes are invented and none is a dish of the catalogue.
- **Evidence of an excluded term:** the term is terracotta with no minus in front, in Buscar and in the home.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `home`: "The informative home describes the product without data" now describes the cover, the sample pieces, the three features and the closing block, and allows invented sample dishes while still forbidding catalogue and user data.
- `menu-planner`: "Candidate cards with evidence and a choose button" drops the minus of an `exclude` term in an evidence line; the screen reader text still says "excluido".

## Impact

- **UI:** `features/welcome/components/welcome-screen.tsx` and its test; `app/page.tsx` and a new `app/_welcome/` that builds the sample pieces with the components of Buscar, Menú and Compra and passes them to the welcome as slots (ADR-001 §3: a feature does not import another one). `features/weekly-menu/components/recipe-card.tsx` gains an option to start open. `features/menu-planner/components/menu-candidate-card.tsx` drops the minus.
- **Application, domain, infrastructure:** none. No action, port or query changes. The home still reads nothing but the session.
- **Data touched:** none. The sample pieces are constants in the code with invented dishes, checked against the local catalogue by a script that reads `data/` and never writes it.
- **Abuses and OWASP:** no endpoint or server action is added or changed. A01 (broken access control) and SEG-sistema-cerrado: the visitor must still get no catalogue or user data; the samples are invented, the page reads no data, and the existing tests that a visitor's response holds no catalogue dish, email or version stay. A04 (insecure design): the sample pieces are not operable, so a visitor cannot trigger a search, a choice or a tick.
- **Accessibility:** without the minus, an excluded term in a mixed `sameDish` unit is told from an included one by colour only on screen (WCAG 1.4.1); the screen reader text keeps "excluido". The design system chose this; it is recorded here so the trade-off is visible.

## Decisions it relies on

- **UI-design-system:** the design system is the visual source of truth; `VERSION` is refreshed here.
- **UI-home-sin-login** and **SEG-sistema-cerrado:** the home of a visitor has no catalogue or user data and no sign-up. Invented sample dishes are not catalogue data.
- **SEG-datos-nutricionista:** no catalogue dish reaches the repo through the samples.
- **UI-punto-de-corte:** the layout switches at 800 px of the container, the gutter at 640 px.
