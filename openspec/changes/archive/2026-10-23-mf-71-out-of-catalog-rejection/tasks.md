# Tasks

## 1. The fifth category in the decomposer

- [x] 1.1 Refactor (design D5): export `REJECTION_CATEGORIES` from `src/application/dto/decomposition.ts`, derive `RejectionCategory` from it, and import it in the port, the evaluation and the golden set reader; verify `pnpm typecheck` and the existing tests of those files stay green
- [x] 1.2 RED: test in `src/application/services/search/decompose-text.test.ts` for "Out-of-catalog rejection" (an answer with the rejection `out-of-catalog` returns that rejection); run it and see it fail
- [x] 1.3 GREEN: add `out-of-catalog` to `REJECTION_CATEGORIES`; verify 1.2 passes and the "Unknown rejection category" test still refuses `spam`

## 2. The prompt

- [x] 2.1 RED: extend `src/infrastructure/genkit/decomposer-prompt.test.ts` so that it expects the category `out-of-catalog` described and with one example; see it fail
- [x] 2.2 GREEN: describe `out-of-catalog` in the prompt (only desserts, breakfasts or drinks; a request that also asks for a lunch or dinner dish is a search, design D2) with one example of its own; verify 2.1 passes and the test that no golden set request appears in the prompt still passes

## 3. The golden set

- [x] 3.1 RED: tests in `evals/decomposer/golden-set.test.ts` for the scenarios "Valid out-of-catalog request", "Valid trap request", "Trap request with a rejection", "Trap request without constraints", and the composition scenarios "Wrong number of rejected requests" (15), "Wrong number of out-of-catalog requests" (5) and "Wrong number of trap requests" (4); see them fail
- [x] 3.2 GREEN: update `evals/decomposer/golden-set-schema.ts`: the category, the origin `catalog-trap`, at least one constraint for a trap, and the counts; verify 3.1 passes (the test over the real file fails until 3.4)
- [x] 3.3 Author step: run the blind generation prompt for out-of-catalog requests in another-family LLM (design D4); write the prompt, the unedited candidates and the selection of 5 into `evals/decomposer/rejected-requests.md`, and add them as `X11`–`X15`
- [x] 3.4 Author step: pick 4 trap requests from the dish names of the catalog (design D3), starting with "tostadas de calabaza" and "agridulce", label them as `T01`–`T04` with the labelling guide, and add them; verify the golden set test over the real file passes
- [x] 3.5 Update rule 9 of `evals/decomposer/labelling-guide.md` with `out-of-catalog`, design D2 and the trap origin; verify by reading it against the spec "Rejected requests" and "Trap requests"

## 4. The evaluation

- [x] 4.1 RED: tests in `src/infrastructure/golden-sets/file-golden-set-source.test.ts` (a request with the rejection `out-of-catalog` is read as that expected rejection) and in `src/application/use-cases/evaluation/evaluate-decomposer.test.ts` for "Out-of-catalog hit" and "Trap request rejected"; see them fail
- [x] 4.2 GREEN: the reader accepts the category and the evaluation reports its row; verify 4.1 passes
- [x] 4.3 Check that `evaluate-search` reads only the expected structures of retrieval queries (design, Risks); if the trap ids reach it, filter them out with a test first; verify `pnpm test:run` over `src/application/use-cases/evaluation/`

## 5. The planner message

- [x] 5.1 RED: in `src/features/menu-planner/search-view.test.ts`, the scenario "Out-of-catalog request" gives "Los menús solo tienen comidas y cenas: no hay postres, desayunos ni bebidas." and "Rejected request" keeps the generic message for the other four categories; see it fail
- [x] 5.2 GREEN: choose the message by category in `toFailedState` (design D6); verify 5.1 passes

## 6. Documentation

- [x] 6.1 Add `out-of-catalog` to BUS-descomponedor in `context/decisiones.md`, with the date and the limitation of design (Risks); verify the five categories match `REJECTION_CATEGORIES`
- [x] 6.2 Mark MF-71 done in `context/roadmap.md` and say in «Decir "no hay"» that piece (1) is done

## 7. Measurement and checks

- [x] 7.1 Run `pnpm ingest evaluate-decomposer` (needs `GEMINI_API_KEY`) and commit the new `evals/decomposer/results.md`; verify the rejections table has the `out-of-catalog` row and lists any rejected trap
- [x] 7.2 Run `pnpm typecheck` and `pnpm test:coverage` before opening the PR; verify both pass

## Workflow follow-up

- Ask the author whether the PR bumps `"version"` in `package.json` before `gh pr create`.
- `/opsx:verify`, then go through the checklist in `context/safety-first.md` §4 and `/opsx:archive`.

## Security checklist (`context/safety-first.md` §4), 2026-10-23

- **Business and security decisions in the backend:** yes. The decomposer runs on the server, and its answer is validated against the closed category list before the planner view picks the message.
- **New endpoints (auth, permissions, negative tests):** not applicable. No endpoint, server action or route is added; the search action keeps its session check.
- **User from the session:** not applicable, for the same reason.
- **Minimum data returned:** yes. A rejection reaches the page as a fixed message; no text of the model is shown.
- **No secrets in the diff:** yes. Checked with a `grep` of the branch diff for keys, tokens, passwords and connection strings: no match.
- **New dependencies:** none.
- **Parameterised queries:** not applicable. No new SQL.
- **Tests with unexpected values and prompt injection:** no new input. The request text was already covered (length limits, the "Injected instruction leaks through as text" scenario of `request-decomposer`); an injection that forces `out-of-catalog` only shows a fixed message, and an unknown category is still refused (`decompose-text.test.ts`).
- **Sensitive actions logged:** not applicable. No sign-in or access decision changes.
- **Deviations from a MUST rule:** none. The message names desserts, breakfasts and drinks together instead of what was asked, a deviation from the example of `context/roadmap.md` recorded in `design.md` D1.
