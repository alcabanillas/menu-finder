# Tasks

No unit tests in this change (proposal, PROC-tdd deviation; design D4): each task is verified by running the scripts and checking their output. `pnpm lint` must stay green at the end of every group.

## 1. Committed inputs

- [x] 1.1 Write `evals/retrieval/queries.json` with the 54 queries (15 literal + 39 others), their `origin` (`llm-blind`; `author` for `alitas de pollo`, `sardinas en lata`, `pulpo`, with `alitas de pollo` also noted as `known-case`) and their rule (design D2), with `A07`, `A08`, `A12` and the literals the author dropped from the review (`L03`, `L04`, `L06`, `L09`, `L12`) as `withdrawn` and their reason; verify it parses, ids are unique and every rule matches the draft's `RULES`
- [x] 1.2 Write `evals/retrieval/dish-labels.json` from the draft: per concept its `criteria`, its `labels` resolved from positions to dish names, and its `rejected` from `data/golden/dish-labels-review.md` (7 fuzzy, 2 `pescado_crudo`); verify the label counts per concept match the draft and there are 9 rejections
- [x] 1.3 Move `data/golden/ingredient-groups.json` to `evals/retrieval/ingredient-groups.json`, adding the `pescado_curado_ahumado` group (`Anchoas en aceite vegetal`, `Salmón ahumado`, `Bacalao, ahumado`); verify it parses and every listed ingredient appears in `data/recetas.json`

## 2. Literal candidates script

- [x] 2.1 Write `scripts/evaluacion/literal-candidates.js` from the draft (spec *Literal candidates*): reads the literal queries from `queries.json` and the menus and recipes from `data/`; refuses to overwrite an existing review; add `evals:literal-candidates` to `package.json`; verify that on a copy of `data/` without the review it reproduces the candidate list of the current review (same menus and grades per query), and that with the review present it exits `1` without writing

## 3. Golden set script

- [x] 3.1 Write the loading and validation of `scripts/evaluacion/build-golden-set.js` (design D3): all inputs, all errors collected, nothing written on error; verify by hand each *Input validation* scenario on temporary copies of the inputs (unknown concept, duplicate id, labelled dish that does not exist, several errors at once, missing `data/menu-platos.json`) and the *Unexpected argument* scenario
- [x] 3.2 Write the dish facts and concept membership (spec *Dish concepts and ingredient groups*, quick concepts of *Attribute and fuzzy queries*); verify on the real data that `Macarrones con berenjena y aceitunas` is not `pescado_crudo` and `Dorada al horno` is not `ligero`
- [x] 3.3 Write the relative grading and the grading per rule kind, and the withdrawal; verify with a throwaway call from `node -e` the numeric scenarios of *Relative grading* and *Presence of a concept*
- [x] 3.4 Write the serialization, the self-checks (design D4) and the report (spec *Golden set report*); add `evals:golden-set` to `package.json`; verify `pnpm evals:golden-set` exits `0`, writes both files and prints the per-type counts

## 4. Parity and freeze

- [x] 4.1 Compare `evals/retrieval/golden-set.json` with `data/golden/golden-draft.json` query by query; verify every difference is explained by design D5 and record the differences in the verify notes
  - Verify notes: no difference in the 31 non-literal queries (see design D5, result); the 10 kept literals take the grades of the author's review.
- [x] 4.2 Run `pnpm evals:golden-set` twice; verify the golden set files are byte-identical (*Reproducible output*) and that no dish name appears in it (*No menu composition in the committed file*)
- [x] 4.3 Verify 43 queries are kept (L10 · E7 · A9 · F8 · C9)
- [x] 4.4 Clean `data/golden/` as in design, Migration Plan step 3; verify a new build from a clean state still gives the same golden set

## 5. Documentation

- [x] 5.1 Update EVAL-golden-sets in `context/decisiones.md` with the four deviations and graded relevance, and record the PROC-tdd deviation for `scripts/evaluacion/` (proposal, Decisions and contradictions); mark MF-12 ✅ in `context/roadmap.md` with the link to the archived change; verify both read coherently with BUS-superficie-consulta
  - `decisiones.md` done (EVAL-golden-sets, PROC-tdd exception); roadmap line added at archive.
- [x] 5.2 Add to `context/tareas/T0-extraccion-previa.md` how to rebuild the golden set (`pnpm evals:golden-set`, inputs in `evals/retrieval/` and `data/golden/literal-candidates.md`); verify the steps run from a clean checkout with `data/` present
- [x] 5.3 Go through the checklist in `context/safety-first.md` §4 and record the result before archiving
  - Result: no endpoint, backend decision, DB query, session or LLM input is touched (N/A). No secret in the diff. No new dependency. Unexpected inputs (missing file, invalid JSON, unknown type or concept, duplicate id, missing dish, unexpected argument) checked by hand, fail closed. Deviation from PROC-tdd documented in the proposal and in `decisiones.md`. The committed files carry no menu composition (self-check).
