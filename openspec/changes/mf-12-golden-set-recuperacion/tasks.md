# Tasks

No unit tests in this change (proposal, PROC-tdd deviation; design D4): each task is verified by running the scripts and checking their output. `pnpm lint` must stay green at the end of every group.

## 1. Committed inputs

- [ ] 1.1 Write `evals/retrieval/queries.json` with the 51 queries (12 literal + 39 others), their `origin` (`llm-blind`; `author` for `alitas de pollo`, `sardinas en lata`, `pulpo`, with `alitas de pollo` also noted as `known-case`) and their rule (design D2), with `A07`, `A08`, `A12` as `withdrawn` and their reason; verify it parses, ids are unique and every rule matches the draft's `RULES`
- [ ] 1.2 Write `evals/retrieval/dish-labels.json` from the draft: per concept its `criteria`, its `labels` resolved from positions to dish names, and its `rejected` from `data/golden/dish-labels-review.md` (7 fuzzy, 2 `pescado_crudo`); verify the label counts per concept match the draft and there are 9 rejections
- [ ] 1.3 Move `data/golden/ingredient-groups.json` to `evals/retrieval/ingredient-groups.json`, adding the `pescado_curado_ahumado` group (`Anchoas en aceite vegetal`, `Salmón ahumado`, `Bacalao, ahumado`); verify it parses and every listed ingredient appears in `data/recetas.json`

## 2. Literal candidates script

- [ ] 2.1 Write `scripts/evaluacion/literal-candidates.js` from the draft (spec *Literal candidates*): reads the literal queries from `queries.json` and the menus and recipes from `data/`; refuses to overwrite an existing review; add `evals:literal-candidates` to `package.json`; verify that on a copy of `data/` without the review it reproduces the candidate list of the current review (same menus and grades per query), and that with the review present it exits `1` without writing

## 3. Golden set script

- [ ] 3.1 Write the loading and validation of `scripts/evaluacion/build-golden-set.js` (design D3): all inputs, all errors collected, nothing written on error; verify by hand each *Input validation* scenario on temporary copies of the inputs (unknown concept, duplicate id, labelled dish that does not exist, several errors at once, missing `data/menu-platos.json`) and the *Unexpected argument* scenario
- [ ] 3.2 Write the dish facts and concept membership (spec *Dish concepts and ingredient groups*, quick concepts of *Attribute and fuzzy queries*); verify on the real data that `Macarrones con berenjena y aceitunas` is not `pescado_crudo` and `Dorada al horno` is not `ligero`
- [ ] 3.3 Write the relative grading and the grading per rule kind, and the withdrawal; verify with a throwaway call from `node -e` the numeric scenarios of *Relative grading* and *Presence of a concept*
- [ ] 3.4 Write the serialization, the self-checks (design D4) and the report (spec *Golden set report*); add `evals:golden-set` to `package.json`; verify `pnpm evals:golden-set` exits `0`, writes both files and prints the per-type counts

## 4. Parity and freeze

- [ ] 4.1 Compare `evals/retrieval/golden-set.json` with `data/golden/golden-draft.json` query by query; verify every difference is explained by design D5 and record the differences in the verify notes
- [ ] 4.2 Run `pnpm evals:golden-set` twice; verify the golden set files are byte-identical (*Reproducible output*) and that no dish name appears in it (*No menu composition in the committed file*)
- [ ] 4.3 Verify 44 queries are kept (L10 · E7 · A9 · F8 · C10), or 45 if the author adds an eighth exclusion query
- [ ] 4.4 Clean `data/golden/` as in design, Migration Plan step 3; verify a new build from a clean state still gives the same golden set

## 5. Documentation

- [ ] 5.1 Update EVAL-golden-sets in `context/decisiones.md` with the four deviations and graded relevance, and record the PROC-tdd deviation for `scripts/evaluacion/` (proposal, Decisions and contradictions); mark MF-12 ✅ in `context/roadmap.md` with the link to the archived change; verify both read coherently with BUS-superficie-consulta
- [ ] 5.2 Add to `context/tareas/T0-extraccion-previa.md` how to rebuild the golden set (`pnpm evals:golden-set`, inputs in `evals/retrieval/` and `data/golden/literal-candidates.md`); verify the steps run from a clean checkout with `data/` present
- [ ] 5.3 Go through the checklist in `context/safety-first.md` §4 and record the result before archiving
