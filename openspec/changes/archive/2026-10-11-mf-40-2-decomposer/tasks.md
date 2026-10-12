## 1. Setup

- [x] 1.1 Keep working on the MF-40 branch (one PR for all of MF-40, decided by the author on 2026-10-11), and verify that `pnpm test:run` passes before any change
- [x] 1.2 Verify that `gemini-3.5-flash-lite` (design.md D9) is still listed for the project key in `GET /v1beta/models` before group 4

## 2. Golden set wording (spec `decomposer-golden-set`)

- [x] 2.1 Verify that the validator already applies "Constraint schema", "Same-dish groups" and "Alternatives groups" to search requests only: `validateGoldenSet` runs those checks on `requests.filter(isSearch)` and the test "reports a rejected request with constraints" passes. No code changes; only the spec wording changes, at archive

## 3. Core: request terms and the use case (design.md D2, D3, D4, D5, D7)

- [x] 3.1 Write failing tests in `src/domain/search/request-terms.test.ts`: a term in the text, a term missing from it, a term in another case ("Pollo" against `pollo`), and surrounding spaces in the text (RED)
- [x] 3.2 Implement `src/domain/search/request-terms.ts` (GREEN)
- [x] 3.3 Write the port `src/application/ports/request-decomposer.ts` (D1) and the DTO `src/application/dto/decomposition.ts` with `DecomposeError` (D7)
- [x] 3.4 Write failing tests in `src/application/use-cases/decompose-request.test.ts`, with a fake port that counts its calls, for the scenarios of "One call, no loop", "Request length", "Decomposition" and "Invalid answers" of spec `request-decomposer`. Include the injection scenario, whose answer is a plain string. Run them and see them fail (RED)
- [x] 3.5 Implement `src/application/use-cases/decompose-request.ts`: the length check, one call, and the answer schema with the order of D2. Reuse the constraint schema and `parseSearchRequest` of `search-menus.ts` without duplicating them (GREEN)
- [x] 3.6 Write a failing test for "Model failures" at the use case: a port failure comes out as `decomposer-failed` with its reason (RED), then make it pass (GREEN)
- [x] 3.7 Refactor with the tests green (REFACTOR): exported function first, helpers below in call order (AGENTS.md)

## 4. Genkit adapter (design.md D2, D5, D6, D9)

- [x] 4.1 Check, with one real call to `gemini-3.5-flash-lite` with `thinkingLevel: 'MINIMAL'` and `GEMINI_API_KEY` from `.env.local`, three things, and write the results in this task:
  - that Gemini accepts the answer schema as structured output;
  - whether `ai.generate` with `output.schema` throws when the answer does not match. If it throws, the adapter reads the answer text and parses it itself (D2);
  - that Genkit sends no `temperature`.

  Results (Genkit 1.42.0, 2026-10-11):
  - Gemini accepts the schema, but only as draft-7 JSON Schema (`z.toJSONSchema(schema, { target: 'draft-7' })`). Zod 4's default, draft 2020-12, fails in Genkit's validator before the call: `no schema with key or ref "https://json-schema.org/draft/2020-12/schema"`. With draft 7, "cenas rápidas sin cerdo" came back as a structure that matches it.
  - `ai.generate` with `output.jsonSchema` throws `ValidationError` ("Schema validation failed") when the answer does not match: wrong JSON and plain text both throw (checked with a model defined with `ai.defineModel`, `@genkit-ai/ai` `generate/action.js` calls `assertValidSchema`). So the adapter does not use `output.jsonSchema` (D2).
  - What works: `config: { thinkingConfig: { thinkingLevel: 'MINIMAL' }, responseJsonSchema }` with `output: { format: 'json', constrained: false }`. Gemini receives `thinkingConfig`, `responseJsonSchema` and `responseMimeType: application/json`, and the adapter parses `response.text`. Without `constrained: false`, the plugin overwrites `responseJsonSchema` with the empty `output.schema` (`gemini.ts`, "request.output?.constrained && jsonMode"), and the model answered a shape of its own. Without `format: 'json'`, `responseMimeType` is not sent.
  - No request carried `temperature`, `topP` or `topK` (request bodies captured with a wrapped `fetch`).
- [x] 4.2 Write failing tests in `src/infrastructure/genkit/genkit-request-decomposer.test.ts`, with a fake `generate` (RED):
  - the request reaches the prompt between the delimiters;
  - the model `gemini-3.5-flash-lite` with `thinkingLevel: 'MINIMAL'`, and no `temperature`, `topP` or `topK` in the config;
  - one call;
  - an error whose message contains the key comes out without it;
  - a `generate` that never answers fails after the timeout (fake timers);
  - an empty answer is a failure;
  - with real Genkit and a model defined with `ai.defineModel` (no network), an answer that does not match the schema, wrong JSON or plain text, reaches the caller as the parsed value or the raw text, and Genkit does not throw. This fixes the behaviour found in task 4.1, so a Genkit update that changes it fails a test.
- [x] 4.3 Implement `src/infrastructure/genkit/genkit-request-decomposer.ts`, with `DECOMPOSER_MODEL`, and `createGenkitRequestDecomposer(apiKey)`, following `genkit-embeddings.ts` (GREEN). A comment says why the schema comes from `zod` 4 and not from `genkit`'s `z`: Genkit only receives the draft-7 JSON Schema (task 4.1). Move `decompositionSchema` from `decompose-request.ts` to the port `request-decomposer.ts`: ESLint refuses an import of a use case from infrastructure (ADR-001 §3, design D2). knip reports `createGenkitRequestDecomposer` as unused until task 5.4 wires it, so groups 4 and 5 go in one commit
- [x] 4.4 Write a failing test in `src/infrastructure/genkit/decomposer-prompt.test.ts`: no `text` of `evals/decomposer/golden-set.json` appears in the prompt, lowercased (RED)
- [x] 4.5 Write `src/infrastructure/genkit/decomposer-prompt.ts` from `evals/decomposer/labelling-guide.md`, with examples written for it, and see 4.4 pass (GREEN). The prompt tells the model to copy the user's words exactly into `term`, without changing gender, number or accents, and without replacing them with a concept (design.md D4)

## 5. Command (spec `request-decomposer`, "Decompose command"; design.md D8)

- [x] 5.1 Write failing tests in `src/cli/run-cli.test.ts` for "No argument" and "Two arguments" (RED), then add `decompose` to `CliCommands`, `ARGUMENTS` and `USAGE` (GREEN)
- [x] 5.2 Write failing tests in `src/cli/commands/decompose.test.ts` for "Structure printed", "Rejection printed", "Request too long at the command" and "Invalid answer at the command", plus a line with a secret that comes out redacted (RED)
- [x] 5.3 Implement `src/cli/commands/decompose.ts` (GREEN)
- [x] 5.4 Write a failing test in `src/composition/cli-container.test.ts` for "Without a key": the result names `GEMINI_API_KEY` and no adapter is built (RED). Then wire `decomposeRequest` in `cli-container.ts` with `requiring(env, [GEMINI_API_KEY], …)` and the command in `src/cli/index.ts` (GREEN)

## 6. Real run

- [x] 6.1 Run `pnpm ingest decompose "cenas rápidas sin cerdo"` and `pnpm ingest decompose "asdfgh"`, and write the two outputs in this task. These are the result of MF-40.2. They are not an evaluation, and no golden-set request is tuned from them (EVAL-golden-sets)

  Results (2026-10-11, `gemini-3.5-flash-lite`):
  - `pnpm ingest decompose "cenas rápidas sin cerdo"`, exit code 0:
    `{"constraints":[{"id":"c1","type":"attribute","term":"rápidas","polarity":"include","hard":false,"slot":"dinner"},{"id":"c2","type":"exclusion","term":"cerdo","polarity":"exclude","hard":false}],"sameDish":[],"anyOf":[]}` (printed indented)
  - `pnpm ingest decompose "asdfgh"`, exit code 3: `The request is not a search for menus: gibberish`

## 7. Documentation

- [x] 7.1 `context/roadmap.md`: the MF-40 parent still says "61 peticiones" and "el golden set gana unas cuantas"; change them to the 71 requests, 10 of them rejected, of MF-40.1
- [x] 7.2 `context/decisiones.md` IA-proveedor: the decomposer uses `gemini-3.5-flash-lite`, not Flash, and MF-40.3 compares it with `gemini-3.8-flash` (design.md D9, decided by the author on 2026-10-11). `context/roadmap.md` MF-40.3: add that comparison
- [x] 7.3 Commit `scripts/evaluacion/term-variants.ts` and its `evals:term-variants` script in `package.json`, the analysis behind design.md D4
- [x] 7.4 `context/decisiones.md` IA-proveedor: the Genkit Developer UI is an optional local tool, run with `pnpm dlx genkit-cli@<genkit version>`, never a dependency (design.md D10)

## 8. Verification

- [x] 8.1 Run `pnpm lint`, `pnpm typecheck` and `pnpm test:run`, and verify everything passes
- [x] 8.2 Run `openspec validate mf-40-2-decomposer --strict` and verify it passes

## Security checklist (`context/safety-first.md` §4), 2026-10-11

- **Business and security decisions in the backend:** yes. Every check of the model's answer lives in the use case `decomposeRequest`: shape, rejection, `parseSearchRequest` and the literal term. The adapter only calls the model and parses its text.
- **New endpoints (auth, permissions, negative tests):** not applicable. There is no endpoint: `decompose` is a local CLI command, run by the owner like the other `ingest` commands (proposal, A01). Its negative tests cover validation: no argument, two arguments, no key, a request too long, an invalid answer.
- **User from the session:** not applicable. There is no session in the CLI.
- **Minimum data returned:** yes. The command prints the structure, the rejection category or the names of the failing fields. An answer of the model that is not a decomposition is never printed (test "refuses plain text from an injected request and returns none of it").
- **No secrets in the diff:** yes. Checked with a `grep` of the branch diff against `main` for Gemini keys and connection strings with a password: 0 matches, apart from the fake values of the tests. The API key is redacted from every error of the adapter, and every printed line passes through `redactSecrets`.
- **New dependencies:** none. The only change to `package.json` is the script `evals:term-variants`. `genkit-cli` was tried as a development dependency and removed, because it brought 10 advisories (design.md D10).
- **Parameterised queries:** not applicable. No new SQL.
- **Tests with unexpected values:** yes. Empty and whitespace-only requests, 300 and 301 characters, 300 and 301 emojis (length counted in characters), unknown fields at both levels, unknown type and category, a group naming an unknown constraint, a request that holds the delimiters `</request>` and `<request>`, and a prompt injection whose answer is plain text.
- **Sensitive actions logged:** not applicable. There is no login or access decision.
- **Deviations from a MUST rule:** none. The daily LLM limit (SEG-rate-limit) does not apply to the CLI; that is documented in the proposal.
