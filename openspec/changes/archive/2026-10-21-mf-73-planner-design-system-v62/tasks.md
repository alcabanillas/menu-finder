# Tasks: MF-73 `/planner` at design system version v62

Every group: the test of each scenario is written first and seen failing (PROC-tdd), then the code. During apply, no `pnpm lint`; run `pnpm typecheck` and the tests of the files touched (`AGENTS.md`).

## 1. Design system copy

- [x] 1.1 Write `1792443153-9554` in `design-system/VERSION`; check that `design-system/tokens.json` has the same content as `project/tokens.json` of the artifact (it did on 2026-10-19: only the final newline differs), run `pnpm ds:tokens` and `pnpm test:run scripts/design-system`, and verify `src/app/theme.css` has no diff.
- [x] 1.2 Update the version quoted in the headers of the components this change touches (`menu-candidate-card.tsx`, `random-button.tsx`/chip, `restriction-chip-list.tsx` if touched) and in `design-system/README.md` if it names a version; verify with a search for the old id `1792255497-a1ff` that no touched file still cites it as current.

## 2. Evidence on white (spec: "Candidate cards…", scenario "A mixed unit on white")

- [x] 2.1 Test in `menu-candidate-card.test.tsx`: the mixed unit `arroz` + `marisco` has `text-include` and `text-exclude` terms and no ochre background class; seen failing.
- [x] 2.2 Remove `MIXED_TERMS` from `menu-candidate-card.tsx`; the test passes.

## 3. Suggestions and the random chip (specs: "Suggestions to try", "Choosing a random menu")

- [x] 3.1 Tests for `pickSuggestions(list, random)` (four distinct items, never more than the list has, deterministic with a given `random`) and for the list (twelve entries, each the `text` of a non-`withdrawn` query of `evals/retrieval/queries.json`, read with `fs`); seen failing.
- [x] 3.2 Add `features/menu-planner/suggestions.ts` with the list (the mock's wording where the set has it) and `pickSuggestions`; the tests pass.
- [x] 3.3 Tests in `planner-search.test.tsx`: before a search the page shows "Prueba con", "Al azar" first and four requests, and no button "Elegir uno al azar" (the scenarios "Before searching" and "No loose random button"); a request is a submit button `name="request"` inside its own form; after a search with menus neither "Prueba con" nor "Al azar" is shown; the request posts as the search does (`The request text is not in the URL`); seen failing.
- [x] 3.4 `app/(signed-in)/planner/page.tsx` picks the four suggestions and passes them to `PlannerSearch`; build the row (`suggestions-row.tsx`); turn `random-button.tsx` into the chip `random-chip.tsx` (dice icon, ink border, `onAsk` when the week has a menu) and remove the two-width copies from `planner-search.tsx`; the tests of 3.3 and the existing random scenarios (`Choosing a random menu`, `Asking before replacing`) pass, with their wording updated to the chip.
- [x] 3.5 Update `e2e/` specs that use "Elegir uno al azar" to the chip "Al azar", and add a spec that "Prueba con" is shown with "Al azar" first and no loose random button (a spec that runs a search is not possible: no E2E spec has the model). Verify with `pnpm test:e2e e2e/planner.spec.ts e2e/weekly-flow.spec.ts`. **Run on 2026-10-19:** `e2e/planner.spec.ts` 8 of 8 pass; `e2e/weekly-flow.spec.ts` fails at its last step (the ticked item is not ticked after a reload), and it fails the same way on `main` without this change, so it is not caused by it.

## 4. Layout of the results (spec: "Layout of the results")

- [x] 4.1 Tests: the strip "Lo que has pedido" is a sibling above the results and not inside a side column; the card list carries the one-column class and the two-column class from `@min-[1100px]`; the content is left-aligned (no `mx-auto`/`text-center` on the planner content); seen failing.
- [x] 4.2 Rewrite `ResultsArea` in `planner-search.tsx` (strip, then results; grid `1` → `@min-[1100px]:2`); the tests pass.

## 5. No results and "Editar mi búsqueda" (specs: "No menu fits", "Editing the last request")

- [x] 5.1 Tests in `search-view.test.ts`: the `ranking` state carries `request` exactly as sent (with spaces, accents, 300 characters); in `planner-results.test`/`planner-search.test.tsx`: the panel shows the heading, the sentence, the tip, "O prueba con algo que suele funcionar" and four suggestions led by "Al azar"; "Editar mi búsqueda" puts `"  cenas sin horno  "` in the box, focuses it with the caret at the end, sends nothing, gives the same text a second time, and is not rendered without a request; a suggestion of the panel searches again; seen failing.
- [x] 5.2 Add `request` to the `ranking` state in `toSearchState` and pass the untrimmed text from `searchMenusAction`; give `SearchBox` a ref to its input; build the no-results panel in `planner-results.tsx` and the button; the tests pass.

## 6. Week preview: data and action (spec: "The week preview needs a session and trusts only the menu")

- [x] 6.1 Tests of `menuPreview` (`menu-preview.test.ts`): a stored menu gives its dishes by day and meal and nothing else (no recipe, file or date); `"12abc"`, `0`, `-3`, `1.5`, a file and no value give `invalid-menu`; a number no menu has gives `unknown-menu`; a failing `find` gives `failed`; seen failing.
- [x] 6.2 Implement `application/dto/menu-preview.ts` and `application/use-cases/menu/menu-preview.ts` over `MenuRepository.find`; wire it in `composition/web/menu-use-cases.ts`; the tests pass and `composition/web-container.test.ts` still passes.
- [x] 6.3 Tests of `previewMenuAction` in `actions.test.ts`: without a session it reads nothing and sends to `/login` (the check comes before reading the value); one value is read and the rest ignored; the two messages of the spec. Add the action to the check of `protected-pages.test.ts` if it lists actions; seen failing.
- [x] 6.4 Implement `previewMenuAction`; the tests pass.

## 7. Week preview: panel and button (spec: "Week preview of a card")

- [x] 7.1 Move `DAY_BARS` to `shared/` (second feature uses it) and fix its imports; `pnpm typecheck` and the tests of `weekly-menu` pass.
- [x] 7.2 Tests of `EvidenceLine.dish` in `search-view.test.ts` and of the marks (by `(day, meal, name)`, ✓ / ≈, terms joined by " y " or " o ", nothing for a loose exclusion); seen failing; implement in `search-view.ts`.
- [x] 7.3 Tests of `week-preview-panel.test.tsx`: eyebrow "Candidato #N" or "Vista previa", `h2` "Menú N", ✕ "Cerrar vista semanal", Monday to Saturday and Sunday only with dishes, colour bars, marks, "Cargando…" and the failure message, the footer button (choose, replace with its question, "Menú del 5 oct" disabled), Escape closes, the backdrop closes; seen failing.
- [x] 7.4 Tests of the button in `menu-candidate-card.test.tsx` (secondary, calendar icon, after the choose button, `aria-haspopup="dialog"`, `aria-expanded`, accessible name "Ver semana del Menú N", olive style while open) and of the hook `useWeekPreview` (opens, loads once per menu, another card replaces it, a new search closes it, focus returns to the button on close); seen failing.
- [x] 7.5 Implement `week-preview-panel.tsx`, `use-week-preview.ts`, the button in `menu-candidate-card.tsx` (`onViewWeek`, `viewing`) and the wiring in `planner-search.tsx` and `planner-results.tsx`, with the confirmation in one place (design D4); the tests pass.
- [x] 7.6 No E2E for the preview: a card needs a search, and no E2E spec has the model (design D1 keeps the read behind a server action that only the page calls). Covered by `planner-search.test.tsx`, `use-week-preview.test.tsx`, `week-preview-panel.test.tsx`, `menu-preview.test.ts` and `actions.test.ts`, and by eye in 8.1.

## 8. Check by eye and close

- [x] 8.1 Start the dev server and check `/planner` at 390 px and at 1280 px: the suggestions row, the strip and two columns (a container of 1100 px or more), the no-results panel with "Editar mi búsqueda", the preview as a bottom sheet with backdrop and as a right panel below the header (the fixed panel is placed against the viewport, design Risks), and the mixed evidence unit on white; take screenshots and fix what differs from the mock.
- [x] 8.2 Update `openspec/specs` via the archive flow only (not by hand); run `pnpm typecheck`, then `pnpm test:run` on the files touched and `pnpm test:coverage` before `gh pr create`; ask the author whether the PR raises `"version"` in `package.json` (`AGENTS.md`).
- [x] 8.3 Registry: in `project/implementacion.md` of the design system artifact, set each row of Buscar to `implementado` (or `parcial`, with what is missing) with this change's PR as ticket, and the date of the audit; publish it to the artifact, or give the author the list of rows to change if it cannot be published.

## Workflow follow-up

- Archive `mf-61-ranking-explanation` before archiving this change.
- Run the checklist of `context/seguridad/safety-first.md` §4 before archiving, and record the result.
- The author confirms the roadmap ID (MF-73 is provisional) and adds the item to `context/roadmap.md`.
