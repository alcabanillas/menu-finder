## Why

MF-40.3 (`context/roadmap.md`, item MF-40). The decomposer of MF-40.2 works on a request typed at the terminal, but nobody knows how well: the golden set of MF-13 and MF-40.1 holds 71 requests labelled before the decomposer existed, and nothing compares them with what the model answers. Without that number, the choice of `gemini-3.5-flash-lite` (MF-40.2 design D9) rests on its price sheet, and the presentation has no figure for the decomposer (EVAL-golden-sets).

## What Changes

- The port `GoldenSetSource` also returns each request of the decomposer golden set with its text and its expected answer: a structure, or a rejection with its category. Today it returns the structure only, and the rejected requests come through as a structure with an extra key.
- A use case `evaluateDecomposer` that sends the text of every request to the decomposer, once, for each model, and compares the answer with the label:
  - a constraint is a hit when its `term` (exact, lowercased), `type` and `polarity` match an expected constraint of the same request, one to one;
  - precision and recall per constraint type and overall, summed over all the requests;
  - `hard` and `slot` as the share of hits whose value also matches;
  - `sameDish` and `anyOf` groups in their own rows: a group is a hit when it joins the same hit constraints as an expected group;
  - rejections per category, and the search requests the model rejected by mistake;
  - a failed call or an invalid answer counts as an answer with no constraints, and the request is listed by id.
  These rules were chosen by the author on 2026-10-11 and recorded in the MF-40.3 line of `context/roadmap.md`.
- Two models on the same golden set: `gemini-3.5-flash-lite`, the model of the decomposer, and `gemini-3.8-flash` (MF-40.2 design D9). The adapter takes the model as a parameter, and its default stays `gemini-3.5-flash-lite`.
- The CLI command `pnpm ingest evaluate-decomposer`, which writes the table to `evals/decomposer/results.md` and prints the misses of each request at the console. It needs `GEMINI_API_KEY` only, with no database.
- The real run, with both reports committed. The rule for keeping Lite is not fixed in advance: the author decides it on the results, and the presentation says so (decided by the author on 2026-10-11).

No change to the decomposer, to the search, to the web or to the golden set data.

## Capabilities

### New Capabilities
- `decomposer-evaluation`: the inputs, the matching rules, the metrics, the two models, the report and the `evaluate-decomposer` command.

### Modified Capabilities
None. `decomposer-golden-set` describes the data, which does not change; `request-decomposer` describes the decomposer, which is used as it is.

## Impact

- **Code:** the port `src/application/ports/golden-set-source.ts` and its adapter `src/infrastructure/golden-sets/file-golden-set-source.ts`; the scoring rules in `src/domain/search/`; a use case and its DTO in `src/application/`; the model parameter of `src/infrastructure/genkit/genkit-request-decomposer.ts`; a command in `src/cli/commands/`; wiring in `src/composition/cli-container.ts`, `src/cli/run-cli.ts` and `src/cli/index.ts`.
- **Evaluation data:** `evals/decomposer/results.md`, new.
- **Dependencies:** none.
- **Cost:** one run is 142 calls (71 requests, two models), sequential, on the paid tier. At the prices of MF-40.2 design D9 that is cents.
- **Size:** the roadmap gives ~2 h. With the port change and the group rows it is closer to 3 h. The item is already a subtask of MF-40, and the author asked for it to run through `apply` in one go.
- **Decisions it relies on:** EVAL-golden-sets, BUS-descomponedor, IA-proveedor, SEG-datos-nutricionista.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* the 71 requests of the golden set, already public in the repository, sent to the Gemini API on the paid tier (IA-proveedor). No nutritionist data: the decomposer golden set holds no dish or menu text.
  - *Abuses:* X07 and X08 of the golden set are prompt injections on purpose. They reach the model as data and come back as a rejection or an invalid answer: the decomposer of MF-40.2 is the barrier, and this change only counts the outcome (A05, LLM01). Unbounded consumption (LLM10): the run is a fixed 142 calls, each with the 20-second timeout of the adapter, and only the owner runs it. The API key in an error (A02): every printed line passes through `redactSecrets`.
  - *What is written:* the report holds request ids, model names and numbers only. The terms of the misses are printed at the console, never written.
  - *Not applicable:* authorization (A01) and the session, because the command is local and run by the owner.
