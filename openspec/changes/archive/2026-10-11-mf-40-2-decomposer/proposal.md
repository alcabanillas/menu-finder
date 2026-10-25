## Why

MF-40.2 (`context/roadmap.md`, item MF-40). The search runs on a typed structure (`searchMenus`, spec `menu-search`), but nothing turns a request in natural language into that structure yet: today the structure is written by hand in a JSON file. The decomposer is that step (BUS-descomponedor), and MF-40.3 cannot measure it against the golden set until it exists.

## What Changes

- A new port for the decomposer: given the text of a request, it returns what the model answered, unvalidated. No existing port covers text generation; `EmbeddingsPort` only embeds.
- A use case `decomposeRequest` that limits the length of the text, calls the port once, with no loop (BUS-descomponedor, IA-criterio-agente), and validates the answer:
  - a rejection with its category (`gibberish`, `off-topic`, `instruction`, `not-a-search`) comes back as a typed error;
  - a structure is validated with `parseSearchRequest` of `searchMenus`, and every `term` must appear in the request text, so the model cannot add a term the user did not write;
  - an empty structure (a search the four types cannot hold, such as A12 "platos para el finde") is a valid answer, not a rejection;
  - an answer that does not validate is rejected, never repaired (`context/seguridad/safety-first.md` §2.6).
- A Genkit adapter with `gemini-3.5-flash-lite`, structured output, minimal thinking and a timeout. It replaces "Flash" in IA-proveedor, decided by the author on 2026-10-11, and MF-40.3 compares it with `gemini-3.8-flash` (design.md D9). The request goes into the prompt as delimited data. The prompt follows `evals/decomposer/labelling-guide.md` and holds no golden-set request, so the evaluation in MF-40.3 stays blind (EVAL-golden-sets).
- The CLI command `pnpm ingest decompose "<request>"`, which prints the structure as JSON or the rejection with its category. It needs `GEMINI_API_KEY` only, with no database.
- The spec `decomposer-golden-set` says that each *search* request has constraints and groups. Since MF-40.1, a rejected request has none, and three requirements still say "each request".

No change to the search, to the web or to the golden set data.

## Capabilities

### New Capabilities
- `request-decomposer`: the request → structure step, its validation, its limits and the `decompose` command.

### Modified Capabilities
- `decomposer-golden-set`: "Constraint schema", "Same-dish groups" and "Alternatives groups" apply to search requests, not to rejected ones. The wording changes, not the behaviour: the validator already skips rejected requests (MF-40.1, design D1).

## Impact

- **Code:** a port in `src/application/ports/`, a use case and its DTO in `src/application/`, the constraint schema moved from `searchMenus` to `src/application/dto/search-request.ts` (design.md D2), an adapter in `src/infrastructure/genkit/`, a command in `src/cli/commands/`, wiring in `src/composition/cli-container.ts` and `src/cli/run-cli.ts`.
- **Dependencies:** none. `genkit` and `@genkit-ai/google-genai` 1.42.0 and `zod` are already installed.
- **Decisions it relies on:** BUS-descomponedor, BUS-superficie-consulta (d) and (f), IA-proveedor, IA-criterio-agente, SEG-rate-limit, EVAL-golden-sets.
- **Rate limit:** the daily LLM limit (SEG-rate-limit, spec `rate-limiting`) is not applied: SEG-rate-limit puts it in the web adapter, and the CLI runs locally (decided by the author on 2026-10-11). The web use of the decomposer is MF-22.
- **Security (safety-first P1, SEG-owasp):**
  - *Data touched:* the text of the request, typed by the owner at the terminal, and sent to the Gemini API on the paid tier (IA-proveedor). No nutritionist data reaches the prompt or the output.
  - *Abuses:* prompt injection in the request ("ignora todas las instrucciones", X07 and X08 of the golden set) to make the model emit something other than a structure (A05 injection, LLM01). The barrier is the schema: the use case accepts only a valid structure or a rejection, and the structure never becomes SQL by itself (BUS-superficie-consulta (f)). A very long request to raise cost or latency (LLM10, unbounded consumption): the length limit runs before any call, and the call has a timeout. Leaking the API key through an error message (A02): errors pass through `redactSecrets`, as in `GenkitEmbeddings`.
  - *Not applicable:* authorization (A01) and the session, because the command is local and run by the owner, like the other `ingest` commands.
