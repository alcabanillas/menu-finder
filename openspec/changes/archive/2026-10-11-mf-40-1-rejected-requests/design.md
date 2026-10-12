## Context

`evals/decomposer/golden-set-schema.ts` validates `golden-set.json` with one strict Zod object per request (`id`, `text`, `origin`, `constraints`, `sameDish`, `anyOf`), then runs cross-checks: ids, terms in the text, groups, parity with `evals/retrieval/queries.json` and composition (exactly 7 `llm-blind` requests). The test `golden-set.test.ts` runs it on the committed file and on small inline fixtures.

Three readers use `golden-set.json`:

- the validator;
- `FileGoldenSetSource` (`src/infrastructure/golden-sets/`), for `pnpm ingest evaluate-search`. It looks structures up by the id of each kept retrieval query, so a request with a new id is never read;
- `scripts/evaluacion/similarity-floor.ts` (MF-42). It reads `constraints` from every request and would throw on a request that has none.

## Goals / Non-Goals

**Goals:**
- A rejected request is a distinct, strictly validated shape, not a search request with a flag.
- The 10 requests go into the golden set verbatim, in the order of `evals/decomposer/rejected-requests.md`.

**Non-Goals:**
- How the decomposer rejects (MF-40.2) and how the rejection rate is computed (MF-40.3).
- Any change to the constraint schema (see proposal.md, What Changes).

## Decisions

### D1. A rejected request is a second variant of the request schema, chosen by `origin`

The request schema becomes a discriminated union on `origin`:

- `retrieval-golden-set` and `llm-blind`: the current search request, unchanged.
- `llm-blind-rejected`: `{ id, text, origin, rejection }`, with `rejection` one of `gibberish`, `off-topic`, `instruction` or `not-a-search`.

Both variants stay strict, so a `rejection` on a search request and a `constraints` list on a rejected request are reported as unrecognized keys. The cross-checks (terms, groups, alternatives) run on search requests only. Ids and parity run on all requests.

*Alternative:* an optional `expected: 'reject'` on every request, with empty `constraints`. Rejected because an empty list already means something else: a search the four types cannot hold (A12 "platos para el finde", labelling guide rule 7). The decomposer answers A12 with an empty structure and "asdfgh" with a rejection. With a flag, the two cases would share one shape and the validator could not keep them apart.

*Alternative:* `origin: 'llm-blind'` plus `rejection`. Rejected because the composition check counts `llm-blind` as the 7 long requests, and the origin already says where a request comes from: here, a separate blind generation.

### D2. Ids `X01`–`X10`, in the order of `rejected-requests.md`

The prefixes `L`, `E`, `A`, `F`, `C` and `R` are taken. `X` reads as "rejected" and keeps the ids short. Texts and categories are copied verbatim from the LLM's output; nothing is edited.

### D3. Composition counts rejected requests like long ones

A constant `REJECTED_REQUESTS = 10`, checked the way `LONG_REQUESTS` is, with a message that names the expected number. The spec's total of 71 follows from the three counts and the parity with the retrieval queries; no separate total is checked.

### D4. `similarity-floor.ts` skips requests without constraints

`goldenTerms` reads `constraints ?? []`. The script measures the terms of search requests; a rejected request has no terms. Its texts are not added to the control terms either: MF-42 is closed, and changing its input would change a measured result.

## Risks / Trade-offs

- **Zod issue paths in a discriminated union** → an unknown `origin` may come back as a union issue rather than a plain field issue. The scenario "Unknown origin" pins the expected output (request and field `origin`); `toIssue` maps it if the path differs.
- **Easy gibberish inflates a single rate** → MF-40.3 reports the rejection rate per category (proposal.md, Impact).
- **Two requests contain injection text** (`rm -rf /`, "ignora todas las instrucciones") → they are JSON strings read only by the validator and, from MF-40.3, sent as input to the decomposer, which is exactly what they test. Nothing executes them.
