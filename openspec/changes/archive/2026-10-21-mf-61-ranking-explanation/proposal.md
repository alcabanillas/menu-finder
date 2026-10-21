# Proposal: MF-61 deterministic explanation on the top-5 cards

Roadmap item: **MF-61** (`context/roadmap.md`, Sprint 3). One change, no subtasks (decided by the author on 2026-10-19).

## Why

The `/planner` cards show one evidence line per chip, but they do not say how much of the request a menu meets, and they present every evidence dish the same way. With the `semantic` strategy of the web, every term gets a rescaled score for every dish, so the best dish of a menu is shown with a check even when it is far from the request (score 0.15), or when another dish of the same menu has the term word for word. UI-planner-buscador asks for the *why* of each candidate, built by a template from the search data, without an LLM (decided by the author on 2026-10-18): it cannot invent anything, so there is no faithfulness to measure (MF-29 was dropped for that reason).

## What Changes

- **Evidence of a unit (search):** for each unit of a returned menu, the search picks the dish in three steps (decided by the author on 2026-10-19):
  1. a dish that contains the term word for word, as the lexical strategy matches it → `literal`;
  2. otherwise, the dish with the best score for the unit, only when that score reaches the matching threshold of the strategy (`MATCH_THRESHOLD`, the same one the hard filter uses) → `similar`;
  3. otherwise, no dish.
  Each evidence item says which one it is. The menu score and the ranking do not change: only the dish shown as evidence and its kind.
- With the `semantic` strategy the search also runs the text match of each scored term (one database query per term, no model call), to know which dishes are literal. The `hybrid` strategy already has it.
- **Card (planner), from the design system version `1792433417-7fa2` (UI-design-system):**
  - Each evidence line starts with its state: ✓ (olive) a literal dish, ≈ (ochre) a similar dish with the detail starting "parecido: ", ✕ (terracotta) "ningún plato". A week-wide exclusion is always "✓ … no aparece en la semana".
  - Under "Menú N", which becomes the title of the card in place of the black badge, a fixed summary sentence built from the counts: "Cumple las N cosas que pides." or "Cumple X de las N cosas que pides.", followed by ", una con un plato parecido." / ", dos con platos parecidos." when there are ≈ lines. Every unit counts, the week-wide exclusions included.
  - A results heading with the real count: "Los N que mejor encajan", or "El que mejor encaja" for one.
  - A request with only week-wide exclusions: heading "Todos cumplen lo que pides", the line "Como solo has pedido quitar cosas, todos estos menús lo cumplen por igual: salen por número de menú." and cards without rank and without summary.
  - No menu: "Ningún menú encaja con lo que has pedido" as a heading.
- The CLI `search` and `search-text` commands print the kind of each evidence dish.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `menu-search`: "Top five and ties" — the evidence of a unit follows the three steps and carries its kind.
- `menu-planner`: "Candidate cards with evidence and a choose button" (state of each line, summary sentence, "Menú N" as title), "No menu fits" (heading), and a new requirement for the results heading, with the case of a request with only week-wide exclusions.

## Decisions it relies on

- **UI-planner-buscador:** the *why* is a deterministic template over the search data, without an LLM.
- **BUS-superficie-consulta (b):** the week-wide exclusion is a lexical filter and does not count in the score; its line is always "no aparece en la semana", never "ningún plato lo lleva", because the filter only looks for the word.
- **BUS-superficie-consulta (d):** the literal check reuses the text match of the lexical strategy; nothing is interpreted.
- **BUS-superficie-consulta (e):** top 5 over the minimum score of 0.6; unchanged.
- **UI-design-system:** the card and the results states come from the mock `PlannerScreen.jsx` and `MenuCandidateCard.jsx`.

No decision is contradicted. `context/decisiones.md` BUS-discrimina-plato already limits the explanation to *why it fits*.

## Security

- **Data touched:** the dish names, days and meals already returned to the signed-in user; no new data leaves the server, and nothing new is stored or logged. The summary is built from counts, never from model text.
- **Possible abuses:** a term that tries to inject query syntax into the extra text match is already plain text for `phraseto_tsquery` ("Text match of a term"); a long request is already capped at 300 characters before any query, so the extra queries per search are bounded by the terms of one valid request (≤ the constraints the decomposer returns). The daily LLM limit is unchanged: the text match does not call the model.
- **OWASP:** A03 Injection (the term stays a bind parameter), A04 Insecure Design (no generated text, so no prompt-injected explanation, safety-first §2.6), A01 Broken Access Control (the search action keeps checking the session; nothing new is exposed without one).

## Impact

- `src/domain/search/` (evidence of a unit: literal, similar or none), `src/application/services/search/find-menus.ts` (text match with the semantic strategy), `src/application/dto/search-result.ts` (`EvidenceDto` gains its kind).
- `src/features/menu-planner/search-view.ts` and its components (`menu-candidate-card.tsx`, `planner-results.tsx`).
- `src/cli/commands/search.ts` and `search-text.ts` (print the kind).
- Specs `menu-search` and `menu-planner`. The evaluation metrics do not change, because the ranking does not.
