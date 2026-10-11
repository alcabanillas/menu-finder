## Context

- **The search:** `searchMenus` (`src/application/use-cases/search-menus.ts`) takes a `SearchRequestDto` and validates it with `parseSearchRequest`. That function is exported, needs at least one constraint, and checks groups and polarities with `findRequestIssues` from the domain.
- **The CLI:** `pnpm ingest search` reads the structure from a JSON file.
- **Genkit:** used only by `GenkitEmbeddings` (`src/infrastructure/genkit/`). That adapter takes a function to call, so its tests replace the network, and it passes errors through `redactSecrets`.
- **The commands:** `runCli` checks the number of arguments of each command before the container is built, and `cli-container.ts` checks the environment variables before anything runs (`requiring`).
- **The golden set:** it fixes the expected output (spec `decomposer-golden-set`). The longest of its 71 requests has 115 characters (measured with `node` on `golden-set.json`).

## Goals / Non-Goals

**Goals:**
- Text → validated structure or typed rejection, with one model call, from the CLI.
- Everything except the network call is tested without the network: the use case with a fake port, and the adapter with a fake `generate`.

**Non-Goals:**
- Measuring the decomposer: that is MF-40.3. This change reads no golden-set request at runtime.
- Sentry and Genkit traces: MF-40.4.
- Using it from the web, the daily LLM limit and the interpretation of terms ("rápido", groups): MF-22.

## Decisions

### D1. A new port, `RequestDecomposer`, that returns the raw answer

`src/application/ports/request-decomposer.ts`:

```ts
interface RequestDecomposer {
  decompose(request: string): Promise<Result<unknown, DecomposerFailure>>;
}
```

The answer is `unknown`: the port carries what the model said, and the use case decides whether it is valid. That keeps the validation in one place, the core, where it is tested.

The existing ports were read (AGENTS.md):
- `EmbeddingsPort` turns text into vectors, not text into a structure.
- `GoldenSetSource` reads files.
- The rest are repositories, `Clock`, `RateLimiter`, `AuditLog`, `SessionManager`, `AccountCreator` and `MigrationRunner`.

None covers text generation, which is a new external boundary.

*Alternative:* the port returns a validated `SearchRequestDto`. Rejected because the adapter would hold the rules (term in the text, groups), and they would have to be tested through Genkit.

### D2. A flat answer schema: `{ rejection, constraints, sameDish, anyOf }`

The model answers one object whose `rejection` is a category or `null`.

- **The schema lives in the port**, `ports/request-decomposer.ts`, as the contract of that boundary. It is a strict Zod schema built from the constraint schema of `searchMenus` plus `rejection`. It is not in the use case because ADR-001 §3 lets infrastructure import ports and DTOs only (decided by the author on 2026-10-11, when ESLint refused the first version). The constraint schema moves from `searchMenus` to `dto/search-request.ts`, next to the type it describes, so that no port imports a use case. It holds the shape only (fields, types, limits); the rules across constraints and groups stay in `searchMenus`.
- **The adapter imports it from the port**, converts it to a draft-7 JSON Schema and sends it to Gemini as `responseJsonSchema` in the model config, with `output: { format: 'json', constrained: false }`. It does not pass it as Genkit's `output.jsonSchema`: Genkit then validates the answer itself and throws `ValidationError`, which would turn an invalid answer into a model failure (task 4.1). The adapter parses the answer text and hands the result to the use case.
- **The use case validates the answer** with the steps below. The rules apply in this order:

| Answer | Result |
|---|---|
| Not an object, or with an unknown field or value | Invalid answer, naming each field |
| A `rejection` plus any constraint or group | Invalid answer |
| A `rejection` and nothing else | Error `rejected`, with its category |
| No constraints and no groups | The empty structure (D3) |
| Otherwise | `parseSearchRequest`, then the term check (D4) |

*Alternative:* a discriminated union (`{ kind: 'search', … } | { kind: 'rejected', … }`). Rejected because a flat object is the simplest shape to send as a structured-output schema, and the use case can express the "one or the other" rule as a check.

**The adapter does not validate.** If Genkit throws when the answer does not match the schema, that rejection would come out as an adapter failure instead of an invalid answer. Task 4.1 checks how Genkit 1.42.0 behaves. If it validates, the adapter reads the answer text and parses it as JSON, without Genkit's validation.

### D3. An empty structure is a valid answer and skips `parseSearchRequest`

"Platos para el finde" (A12) has no constraints, and it is not a rejection (MF-40.1, labelling guide rule 7). `parseSearchRequest` requires at least one constraint, because the search cannot run without one. So the use case returns the empty structure without calling it.

Whether the search runs on an empty structure is up to the caller: `searchMenus` refuses it today, and MF-22 decides what the web shows.

### D4. Every term must appear in the request text

This is the same rule as the golden set's "Term not in the request": the `term` must appear in the lowercased, trimmed request.

It is a check across the request and the structure, with no I/O, so it goes in the domain: `src/domain/search/request-terms.ts`, with one function that returns the constraint ids whose term is not in the text.

It does two jobs:
- **It stops the model inventing a term** the user never wrote ("La IA no inventa", `context/producto.md` §1).
- **It stops the model interpreting.** "carne roja" must not become "ternera", and "alitas de pollo" must not become "pollo": interpretation belongs to the search (BUS-descomponedor).

The constraints are the chips of the web (BUS-superficie-consulta (e)), and a chip shows the user's own words, formatted by the UI: "cenas rápidas sin alitas" → `[ Rápidas · cena ]  [ Sin alitas ]` (decided by the author on 2026-10-11). So copying the words exactly is the decomposer's job, and the prompt says so.

**What the variants cost, measured.** `pnpm evals:term-variants` ran the real search with variants of six golden-set terms, on 2026-10-11, once. Counts are shared menus in the top five:

| Variant | Lexical | Semantic | Hybrid |
|---|---|---|---|
| "huevos" → "huevo" | 5/5 | 3/5 | 3/5 |
| "salmón" → "salmon" | 5/5 | 4/5 | 4/5 |
| "alitas de pollo" → "pollo" | 1/5 | 2/5 | 0/5 |

- Postgres already matches gender, number and accents (`spanish_unaccent`), and the embeddings move one or two menus.
- Replacing the words with a broader concept changes the result.

So a form variant is a wrong chip rather than a wrong search. When the model does not copy, the request ends in an invalid answer, and MF-40.3 counts how often. If it is frequent, the fix is the prompt or the thinking level, not a looser rule.

**A shorter cut is a different question.** "cuchara" for "de cuchara" shared 1/5 in the semantic search, and it passes this check because both are in the text. Whether the evaluation counts it as a match is decided in MF-40.3.

### D5. Limits

- **Length:** from 1 to 300 characters after trimming. This is about 2.5 times the longest golden-set request (115 characters), and it is checked before any call.
- **Timeout:** 20 seconds. The adapter races the call against its own timer, so a test can check it with a `generate` that never answers.
- **Thinking:** `thinkingLevel: 'MINIMAL'`, set explicitly rather than left to the model's default. Thinking tokens are billed and add latency, and the task is a short extraction.
- **No temperature:** Gemini 3 ignores `temperature`, `top_p` and `top_k`, and later generations answer them with HTTP 400 ([what's new in Gemini 3.6](https://aistudio.google.com/docs/whats-new-gemini-3.6), read on 2026-10-11). The adapter sends none of them. Stability comes from the explicit rules of the prompt.

Constants in `decompose-request.ts` (length) and in the adapter (timeout, thinking level).

### D6. The prompt follows the labelling guide and holds no golden-set request

- **Where it lives:** `src/infrastructure/genkit/decomposer-prompt.ts`.
- **What it says:** it describes the four types, `term`, `polarity`, `hard`, `slot`, `sameDish`, `anyOf` and the four rejection categories, following `evals/decomposer/labelling-guide.md`.
- **The request as data:** it goes between delimiters, and the prompt tells the model that the text between them is data. The delimiters help, but the barrier is D2 (`context/safety-first.md` §2.6).
- **The examples:** written for this prompt.
- **Keeping it blind:** a test checks that no text of `evals/decomposer/golden-set.json` appears in the prompt. A prompt tuned on the exam would make MF-40.3 meaningless (EVAL-golden-sets).

### D7. Errors

The use case returns `Result<SearchRequestDto, DecomposeError>`, with these errors:
- `request-too-short`
- `request-too-long` (with the maximum)
- `rejected` (with the category)
- `invalid-answer` (with issues shaped like those of `SearchRequestError`: `constraint?`, `field`, `message`)
- `decomposer-failed` (with the reason)

The rejection is an error, as the roadmap item says, because the caller must not search with it.

### D8. The command

- **Arguments:** `decompose` takes exactly one argument, the request in quotes, through the `ARGUMENTS` table of `runCli`.
- **Output:** a structure prints as JSON with two-space indentation, and a rejection prints as `Rejected: <category>`.
- **Exit codes:** 0 for a structure, 3 for a rejection, 1 for any error, 2 for a usage error (decided by the author on 2026-10-11). A rejection is a correct answer, not a failure, and a script can tell it apart from a failure of the API without reading the output. No other command of the project uses 3.
- **Container:** it needs `GEMINI_API_KEY` only, with no database.

### D9. Model: `gemini-3.5-flash-lite`, compared with `gemini-3.8-flash` in MF-40.3

The author chose this on 2026-10-11. The model id is a constant of the adapter, `DECOMPOSER_MODEL`.

How the models were found: the models the project key can use were listed through the Gemini API (`GET /v1beta/models`). The Genkit plugin's own list is older and does not include 3.6 to 3.8. Genkit still accepts any `gemini-*` name: its resolver defines a generic model for unknown names.

Why `gemini-3.5-flash-lite`:
- It is stable.
- It supports structured output.
- It is meant for "structured JSON parsing" and high-volume extraction.
- It is the fastest and cheapest of the 3.5 family, and latency matters when the web waits for the chips.

Price per 1M tokens: $0.30 input and $2.50 output, against $0.75 and $3.75 for `gemini-3.8-flash` until 2026-12-31 (pricing page, 2026-10-11). At this project's volume the difference is cents, so cost does not decide. The risk is quality: the rules on "con", "o" and the scope of exclusions are subtle.

So MF-40.3 also runs `gemini-3.8-flash`, the newest Flash, on the same golden set:
- If Lite is good enough, Lite stays.
- Otherwise, try a higher thinking level before changing the model.

This changes IA-proveedor, which said "Flash": recorded in task 7.2.

*Alternative:* `-latest` aliases. Rejected because Google can change the model behind them, and MF-40.3 would measure a moving target. `-preview` models are rejected for the same reason.

### D10. The Genkit Developer UI runs on demand, never as a dependency

To list the models or try the prompt by hand, run `pnpm dlx genkit-cli@1.42.0 start -- tsx <file>`, with the version pinned to that of `genkit`.

Installed as a dev dependency on 2026-10-11, `genkit-cli` 1.42.0 brought 10 new advisories through the lockfile, which OSV-Scanner reads whole, development dependencies included:
- 8 in `adm-zip`, through `@genkit-ai/tools-common`;
- 2 in `extract-zip`.

1.44.1 keeps `adm-zip ^0.5.12`, and `extract-zip` 2.0.1 is its latest version. The author chose to remove it and run it on demand: it never enters `package.json` or `pnpm-lock.yaml`.

## Risks / Trade-offs

- **The answer schema could hit a limit of Gemini's structured output** (nested arrays, enums). Task 4.1 calls the real model once with the schema before the adapter is finished. If the schema is not accepted, the schema is adjusted here before going on.
- **The term check (D4) can refuse a good answer** if the model normalises a word: an accent, a plural, "rápidas" written as "rápido". That is the right outcome, because the golden set labels the words as written. MF-40.3 will show how often it happens.
- **Prompt injection that still validates.** A request could make the model emit a valid but unwanted structure, for example a term copied from the injected text. That structure is only a search over 36 menus: the term goes to full-text and embeddings as data (BUS-superficie-consulta (f)). The harm is a wrong ranking, not an action.

The author accepts this for now, and no filter or second call is added (2026-10-11). It is reviewed with the number of injections that MF-40.3 finds in X07 and X08 (category `instruction`).
- **Cost:** each run is one Flash-Lite call; the command is run by hand by the owner.
- **Without temperature, the same request can give different answers.** MF-40.3 measures one run per request; whether to repeat runs is decided there, with the first numbers.
