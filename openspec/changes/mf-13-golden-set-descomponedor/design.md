# Design

## Context

See proposal.md (Why). The requirements are in `specs/decomposer-golden-set/spec.md`.

Current state that shapes the approach:

- `evals/retrieval/queries.json` has 54 queries (L15 · E7 · A12 · F8 · C12), 11 of them withdrawn from retrieval. MF-12 left `evals/` as the place for committed evaluation inputs.
- Vitest only picks up `src/**/*.test.ts(x)`, and the coverage thresholds and ESLint boundaries only apply to `src/`.
- `zod` is not yet a dependency.

## Goals / Non-Goals

**Goals:**
- A golden set that is plain data. It is written once, reviewed by the author and validated by one test, with no build step.
- The labelling rules are written down, so that the LLM draft, the author's review and MF-28 read the same thing.

**Non-Goals:**
- A script to generate or rebuild the golden set. The draft is a one-off LLM run, and the result is edited by hand.
- Term normalisation and matching: MF-28 decides how a decomposer term is compared with a labelled one.

## Decisions

### D1 — Files

| File | Content |
|---|---|
| `evals/decomposer/labelling-guide.md` | The labelling rules (D4) and the two prompts: generation of the long requests and drafting of the structures. |
| `evals/decomposer/long-requests.md` | The LLM's candidate long requests, and which 7 the author kept and how they were edited. |
| `evals/decomposer/draft.json` | The LLM's draft structures, unedited. |
| `evals/decomposer/golden-set.json` | The reviewed golden set. |
| `evals/decomposer/golden-set-schema.ts` | The Zod schema and `validateGoldenSet(goldenSet, retrievalQueries)`, which returns every issue found. |
| `evals/decomposer/golden-set.test.ts` | One test per spec scenario on small in-memory fixtures (a test asserts that the issue it expects is among those returned), plus one test that validates the real `golden-set.json` against the real `queries.json` and expects no issues. |

All of them are committed: none holds dataset content (proposal, SEG-datos-nutricionista).

### D2 — The test lives next to the data, outside `src/`

The Vitest `unit` project adds `evals/**/*.test.ts` to its `include`. Coverage keeps `src/**` only.

*Alternative:* a validator in `src/domain/evaluation/`. Rejected: the golden set is evaluation data, not product behaviour. Inside `src/` it would come under the 100 % coverage threshold and the boundaries rules for code that no adapter uses. If MF-28 needs the schema from `src/`, it moves there then.

### D3 — Zod, strict, with a cross-check pass

- Strict objects (`z.strictObject`), so an extra field fails (spec *Extra field*).
- A `superRefine` on the whole file for the rules that cross entries: unique ids, `exclusion` ⇒ `exclude`, term included in the text, `sameDish` and `anyOf` groups, composition, and parity with `queries.json`.
- The test collects all issues and reports them in one failure, each with its path (request id, constraint id, field).

*Alternative:* hand-written checks without a dependency. Rejected: BUS-superficie-consulta already chose Zod for the decomposer output, so the dependency arrives anyway, and T3 can start its schema from this one.

**Where the engine's schema will live.** ADR-001 §3 forbids third-party libraries in `domain`. So the engine's Zod schema will not live there either: it goes in the LLM adapter (`infrastructure/llm/`), which validates Gemini's output at the boundary and maps it to a plain TypeScript type in `domain/search/`. That schema is most likely this one extended (`constraintSchema.extend`) with the fields that need judgment: `group` for exclusions and a parameter for attributes.

*Alternative:* define the domain type `Constraint` now and type this schema against it (`z.ZodType<Constraint>`), so a divergence fails the typecheck. Rejected: it would fix a domain type before T3, which decides it with real requests; moving the type later costs a few lines.

### D4 — Labelling rules (content of `labelling-guide.md`)

The label is the author's reading of the request in context; the rules are the default for clear cases. Requests that two reasonable readers label differently are listed in the guide as *Known ambiguous cases*, with the chosen reading, and MF-28 reports them apart.


- **One constraint per condition.**
  - "y" separates constraints; "ni" splits an exclusion ("sin pescado ni marisco" → two).
  - "con" joins constraints into a `sameDish` group.
  - "o" joins included alternatives into an `anyOf` group ("garbanzos o lentejas"). In an exclusion it splits like "ni" ("sin gluten o lactosa" → two). A constraint is not in both kinds of group: "o" inside "con" is left to T3.
- **`term`**: the shortest span of the request that states the condition, lowercased ("carne roja", not "evitar la carne roja"). Slot words are not part of it: "cenas rápidas" → term `rápidas`, slot `dinner`. When the slot is the whole condition ("para cenar"), the term is that span.
- **Type:**
  - `literal`: a concrete dish or ingredient ("merluza", "alitas de pollo").
  - `exclusion`: an excluded ingredient or food group, which the group table resolves, today MF-12's `evals/retrieval/ingredient-groups.json` ("sin cerdo", "sin pescado", "vegetariano", "nada de queso"). Its polarity is always `exclude`.
  - `attribute`: time, effort, season or slot ("rápidas", "fáciles", "para el invierno").
  - `fuzzy`: a vague intention or a hypernym that no group resolves, included or excluded ("de cuchara", "ligero" → `include`; "nada de fritos", "sin pescado crudo" → `exclude`). A hypernym that is also a group counts as `fuzzy` when it is included ("pescado y verduras", "marisco") and as `exclusion` when it is excluded ("sin pescado").
  
  This follows the four mechanisms of BUS-superficie-consulta (d).
- **Exclusion scope.**
  - An exclusion attached to a noun ("arroz sin carne") goes in a group with that noun.
  - A standalone exclusion ("sin cerdo", "nada de cerdo", "vegetariano") stays out of groups, so it applies to the week.
  - An exclusion after a coordination ("pollo y brócoli sin pescado") applies to the week too: it is tied to a dish only inside one item, right after its noun. It matches how MF-12 graded C07 and C10.
- **`hard`** is `true` only with an explicit marker of strictness ("solo", "sí o sí", "nada de nada", "estrictamente"). Otherwise it is `false`: soft is the default (BUS-superficie-consulta (b)).
- **"comida"** sets the slot `lunch` only when it means the meal ("comidas rápidas"), not food in general ("comida reconfortante").
- **Empty list**: a request that none of the four types can hold ("platos para el finde") has no constraints. It is a negative case for the decomposer.

### D5 — Drafting and review

1. The long requests are generated by Claude in a separate conversation, with the generation prompt from the guide and no access to `data/`. It proposes ~15; the author keeps 7 and edits them.
2. Claude drafts the structures for the 61 requests from the guide and the request texts only, and the result goes to `draft.json`.
3. The author reviews all 61 in `golden-set.json`, starting from a copy of the draft. Any rule the review changes is fixed in the guide first. A rule changed after the draft was written is recorded in the guide.
4. The number of requests edited in the review is recorded in `long-requests.md`, as the drafting precision (the thesis figure, like the ~98 % of MF-12).

## Risks / Trade-offs

- [Anchoring bias in the review] → the draft is committed and the edits are countable; the limitation is declared (proposal).
- [Most requests have one constraint] → MF-28 reports metrics separately for reused and long requests, and per type.
- [Labelled terms are spans of text, while the decomposer may normalise] → the matching is MF-28's decision (Non-Goals). Keeping spans keeps the labels free of judgment that T3 has not fixed yet.
- [T3 changes the schema] → renamed or restructured fields are migrated mechanically; new fields that need judgment get labelled in a declared non-blind pass (proposal, deviation 4).
- [The rules in the guide are not machine-checked] → the test checks structure only. The meaning relies on the review, which is the point of a golden set.

## Migration Plan

None. The change adds files; rolling it back means deleting `evals/decomposer/`, the Vitest `include` entry and `zod`.
