> **Status (2026-09-30):** guide approved (3.1); long requests generated (3.2). The author decided to support "o" (BUS-superficie-consulta (a), already in `decisiones.md`), so 2.10–2.12 were added and are done; 3.3 done (R01–R07 unedited); 4.1–4.4 done (golden-set.json reviewed, 181 tests pass); 5.1–5.2 done; all tasks complete, ready to archive. `context/decisiones.md` also has an uncommitted format change (BUS-superficie-consulta moved to its own block), to be committed at the end. Branch `feature/mf-13-golden-set-descomponedor`, not committed yet; the pre-commit hook now passes. Remove this note when the change is archived.

## 1. Setup

- [x] 1.1 Add `zod` as a dependency and `evals/**/*.test.ts` to the `include` of the Vitest `unit` project. Verify: `pnpm install` succeeds and `pnpm test:run` still passes.

## 2. Validator (TDD)

- [x] 2.1 Write the tests for the *Requests* scenarios (every retrieval query reused, retrieval query missing, text differs, duplicate id) against an empty `validateGoldenSet` stub. Verify: they fail.
- [x] 2.2 Implement the request checks in `evals/decomposer/golden-set-schema.ts`. Verify: the tests of 2.1 pass.
- [x] 2.3 Write the tests for the *Constraint schema* scenarios (valid request, unknown type, exclusion with polarity include, extra field, term not in the request). Verify: they fail.
- [x] 2.4 Implement the constraint schema with strict Zod objects and the cross-checks (D3). Verify: the tests of 2.3 pass.
- [x] 2.5 Write the tests for the *Same-dish groups* scenarios (unknown constraint, group of one, constraint in two groups). Verify: they fail.
- [x] 2.6 Implement the group checks. Verify: the tests of 2.5 pass.
- [x] 2.7 Write the tests for *Composition* (long request too simple) and *Validation in CI* (several errors at once). Verify: they fail.
- [x] 2.8 Implement the composition check and the error collection. Verify: the tests of 2.7 pass.
- [x] 2.9 Write the test that validates the real `evals/decomposer/golden-set.json` against `evals/retrieval/queries.json`. Verify: it fails because the file does not exist.
- [x] 2.10 Write the tests for the *Alternatives groups* scenarios (group of one, unknown constraint, excluded alternative, constraint in both kinds of group). Verify: they fail.
- [x] 2.11 Add `anyOf` to the request schema and implement its checks, sharing the `sameDish` group checks. Verify: the tests of 2.10 pass, and the earlier ones still do.
- [x] 2.12 Add the "o" rule and `anyOf` to `labelling-guide.md` (format and rule 1). Verify: the author approves the change before any drafting.

## 3. Labelling guide and long requests

- [x] 3.1 Write `evals/decomposer/labelling-guide.md` with the rules of D4 and the two prompts. Verify: the author approves it before any drafting.
- [x] 3.2 Generate ~15 long requests with Claude in a separate conversation, with the generation prompt and no access to `data/`, and record them in `long-requests.md`. Verify: the file lists the candidates, unedited.
- [x] 3.3 The author selects and edits 7 as `R01`–`R07`, and records the choice in `long-requests.md`. Verify: each one has at least three conditions of at least two types.

## 4. Draft and review

- [x] 4.1 Draft the structures of the 61 requests with Claude, from the guide and the texts only, into `evals/decomposer/draft.json`. Verify: the file has 61 entries.
- [x] 4.2 Copy the draft to `golden-set.json`. The author reviews all 61, fixing the guide first when a rule changes. Verify: the author confirms every request is reviewed.
- [x] 4.3 Record in `long-requests.md` the number of requests edited in the review, per origin. Verify: the figure matches the diff between `draft.json` and `golden-set.json`.
- [x] 4.4 Run the real-file test of 2.9. Verify: `pnpm test:run` passes with no issues.

## 5. Close

- [x] 5.1 Update `context/decisiones.md`: EVAL-golden-sets with the deviations of the proposal, and §2 point 1 with the fields already fixed. Update `context/roadmap.md`: MF-13 to ✅ with the link to the archived change. Verify: both documents cite this change.
- [x] 5.2 Go through the checklist in `context/safety-first.md` §4 and record the result. Verify: the result is recorded in the archive notes.
  - Backend decisions, endpoints, session, authorization tests, returned data, DB queries, logs: not applicable. The change adds evaluation data and a test, with no product code, endpoint, query or runtime input.
  - Secrets: none in the diff (scanned for keys, tokens, passwords and emails).
  - New dependency `zod` 4.6.5: the official package, maintained, and justified by BUS-superficie-consulta (f). `pnpm audit --prod` reports no known vulnerabilities; OSV-Scanner and Dependabot cover it (MF-07).
  - Unexpected input: the only input is the committed golden set. The validator has negative tests for unknown types, extra fields, unknown ids, bad groups and wrong composition, and reports every error at once (A08). No text reaches an LLM at runtime.
  - Nutritionist data: none. The files hold request texts written without access to `data/` and their labels (SEG-datos-nutricionista).
  - Deviations from a MUST rule: none.
