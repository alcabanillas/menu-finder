## 1. Setup

- [x] 1.1 Create the branch `feature/mf-40-1-rejected-requests` from an up-to-date `main`, and verify that `pnpm vitest run evals/decomposer` passes before any change

## 2. Rejected request schema (`design.md` D1)

- [x] 2.1 Write failing tests in `evals/decomposer/golden-set.test.ts` for the scenarios of the requirement "Rejected requests": a valid rejected request, an unknown category, a rejected request without category, a rejected request with constraints, a search request with a rejection, and an empty search that is not a rejection (A12). Run them and see them fail (RED)
- [x] 2.2 Write a failing test for the scenario "Unknown origin" of the requirement "Requests" (request and field `origin`), and see it fail (RED)
- [x] 2.3 Turn the request schema of `golden-set-schema.ts` into a discriminated union on `origin`, keep both variants strict, and run the term, group and alternatives checks on search requests only. Verify the tests of 2.1 and 2.2 and every existing test pass (GREEN)

## 3. Composition (`design.md` D3)

- [x] 3.1 Write a failing test for the scenario "Wrong number of rejected requests": 9 rejected requests give an issue whose message expects 10 (RED)
- [x] 3.2 Add `REJECTED_REQUESTS = 10` to `checkComposition`, and verify the test passes (GREEN)
- [x] 3.3 Refactor with the tests green (REFACTOR): the file keeps `validateGoldenSet` and its helpers in call order (AGENTS.md, short functions)

## 4. Golden set data (`design.md` D2)

- [x] 4.1 Add `X01`–`X10` to `evals/decomposer/golden-set.json`, with texts and categories copied verbatim from `evals/decomposer/rejected-requests.md`, in its order. Verify the committed-file test passes (`pnpm vitest run evals/decomposer`)
- [x] 4.2 Add the ids `X01`–`X10` to the selection table of `rejected-requests.md`, so each candidate shows its id

## 5. Other readers (`design.md` D4)

- [ ] 5.1 Make `goldenTerms` in `scripts/evaluacion/similarity-floor.ts` read `constraints ?? []`, and verify with `pnpm typecheck` and by reading the code that a request without constraints contributes no term (the script needs the database and Gemini, so it is not run)
- [ ] 5.2 Verify that `pnpm vitest run src/infrastructure/golden-sets src/application/use-cases/evaluate-search.test.ts` passes: `evaluate-search` never reads a rejected request

## 6. Documentation

- [ ] 6.1 `evals/decomposer/labelling-guide.md`: add the rule for rejected requests (origin, categories, no constraints, and how they differ from rule 7's empty list), and replace the "later pass" sentence: concepts, food groups and attribute parameters are not labelled for the decomposer
- [ ] 6.2 `context/decisiones.md §2` point 1: close it, so the decomposer schema is the golden set's. Add the three interpretation rules the author chose on 2026-10-11 to BUS-superficie-consulta (d): "rápido" is under 30 minutes, "fácil" or "que no dé trabajo" is the same as "rápido", and the search resolves each excluded term to its food group, with the mechanism decided in MF-22
- [ ] 6.3 `context/roadmap.md`: rewrite MF-40.1 to this scope with its result, add to MF-40.3 that the rejection rate is reported per category, and add the three interpretation rules to MF-22
- [ ] 6.4 `openspec/specs/decomposer-golden-set/spec.md` keeps "MF-28" in its Purpose; change it to MF-40.3, which is the item that measures the decomposer

## 7. Verification

- [ ] 7.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:run`, and verify everything passes
- [ ] 7.2 Run `openspec validate mf-40-1-rejected-requests --strict` and verify it passes
