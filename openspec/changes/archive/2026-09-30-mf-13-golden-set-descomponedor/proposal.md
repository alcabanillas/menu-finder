# Proposal

## Why

Roadmap item **MF-13**. MF-28 measures the precision and recall of the request decomposer per constraint and per type (EVAL-golden-sets, BUS-descomponedor), and it needs a golden set of requests with their expected typed structure, labelled **before** the spike T3 (MF-14) builds the decomposer. Once the decomposer exists, the labelling is no longer blind (roadmap, "etiquetar antes de construir").

The final decomposer schema is still open (`decisiones.md` §2, point 1) and is fixed by T3. So this change labels only what BUS-superficie-consulta already decides, and leaves the rest to T3.

## What Changes

- Add `evals/decomposer/golden-set.json` (committed): 61 requests, each with its expected constraints under a **minimal schema**:
  - per constraint: `type` (`literal`, `exclusion`, `attribute`, `fuzzy`), `term` (the words of the request that express it), `polarity` (`include` / `exclude`), `hard` and an optional `slot` (`lunch` / `dinner`);
  - per request: `sameDish` groups, i.e. the constraints joined by "con" that one dish must satisfy, and `anyOf` groups, i.e. the alternatives joined by "o", any of which satisfies the constraint.
  - An exclusion inside a group applies to that dish; outside any group, it applies to the week (BUS-superficie-consulta (a), (b)).
- The requests:
  - the **54** queries of `evals/retrieval/queries.json` (MF-12), with the same ids. This includes the 11 withdrawn from retrieval, because their reason ("does not discriminate") does not apply to decomposition. Reusing the ids lets MF-28 relate a decomposition error to its retrieval grades.
  - **7** long, realistic requests with several constraints (`R01`–`R07`). An LLM generates them blind in a separate conversation with no access to the data, and the author selects and edits them.
- Add `evals/decomposer/draft.json` (committed): the structures drafted by an LLM of another family than the engine's (Claude; IA-proveedor), before the author's review. The diff with `golden-set.json` is the record of the review.
- Add a Vitest test that validates `golden-set.json` against the minimal schema with Zod. It is the only code in the change.

Out of scope: the decomposer and its final schema (MF-14), the metrics and how terms are matched (MF-28), and normalising terms to concepts or groups.

## Decisions and contradictions

This change **deviates from EVAL-golden-sets** on four points. `context/decisiones.md` is updated at archive:

1. **61 requests, not 50.** The retrieval queries are reused whole, and the 7 long ones cover what they lack: requests with three or more constraints and mixed types.
2. **Most requests are short queries**, not full `/planner` requests. They were written for retrieval. The 7 long ones and the 12 combined ones carry the multi-constraint cases.
3. **The structure is drafted by an LLM and reviewed by the author**, not written by the author. **Declared limitation:** anchoring bias. The author tends to accept the draft, so an error shared by the draft and the reviewer is not detected. It is partly mitigated by committing the draft, so the edits are visible and countable.
4. **Minimal schema.** The golden set only has the fields that BUS-superficie-consulta already fixes. Any field that T3 adds and that needs judgment gets labelled in a later pass, which is **declared non-blind**. Examples: the concept or group a term maps to ("alitas" → chicken, "nada de cerdo" → pork group), or the parameter of an attribute. Fields that are only renamed or restructured are migrated mechanically.

It also **extends BUS-superficie-consulta (a)** with the conjunction "o", which it did not cover. One of the blind long requests asked for "garbanzos o lentejas", a natural way to ask. Without a rule, the golden set could not label it and the decomposer would split it into two constraints, asking the week for both. The semantics are cheap because they mirror "con": one constraint, satisfied by the best dish that meets any alternative. "o" in an exclusion means "ni" ("sin gluten o lactosa"), because excluding either one alone is not what a person means. "o" inside "con" ("arroz con pollo o pescado") is left to T3: nesting both groups is not needed by any request of this set, and T3 sees real ones. `decisiones.md` is updated now, since the decision is taken here.

It relies on PROC-tdd without deviation: the validation test is written first and seen failing, while the file does not exist yet.

## Capabilities

### New Capabilities
- `decomposer-golden-set`: the golden set of requests and their expected constraints, its minimal schema and the labelling rules that MF-28 relies on.

### Modified Capabilities
_None._

## Impact

- **Code:** a new test file and its Zod schema, and the Vitest `unit` project also includes `evals/**/*.test.ts`. `zod` is added as a dependency: BUS-superficie-consulta already chose it to validate the decomposer's output. Nothing in `src/` changes.
- **Data:** only request texts written without access to the dataset, and their structure. No menu, dish list or nutritionist data (SEG-datos-nutricionista). The texts sent to the drafting LLM are the same requests, which contain no dataset content.
- **Security (safety-first P1, SEG-owasp):** no endpoint, command, network access or credentials at runtime. Abuse considered: a malformed or tampered golden set (A08, software and data integrity) that would corrupt MF-28 silently. The test validates it in CI and fails naming the request and the field. New dependency (A06, vulnerable components): `zod`, covered by OSV-Scanner and Dependabot (MF-07).
- **Decisions relied on:** EVAL-golden-sets (with the deviations above), BUS-superficie-consulta (a), (b), (d), (e), (f), BUS-descomponedor, IA-proveedor, SEG-datos-nutricionista, PROC-sdd, PROC-tdd.
- **Docs:**
  - `context/decisiones.md`: BUS-superficie-consulta (a) with "o" (already done), EVAL-golden-sets, and §2 point 1, which records that the labelling fields are fixed and T3 fixes the rest;
  - `context/roadmap.md`: MF-13.
