# Design

## Context

See `proposal.md` (Why). The rejection categories are a closed list repeated in five places: the `RejectionCategory` type (`src/application/dto/decomposition.ts`), the port schema (`src/application/ports/request-decomposer.ts`), the evaluation rows (`src/application/use-cases/evaluation/evaluate-decomposer.ts`), the golden set reader (`src/infrastructure/golden-sets/file-golden-set-source.ts`) and the golden set validator (`evals/decomposer/golden-set-schema.ts`). The prompt (`src/infrastructure/genkit/decomposer-prompt.ts`) describes each category with one example that must not be a golden set request (MF-40.2 design D6, checked by a test). `/planner` maps every rejection to one message (`MESSAGES.rejected` in `src/features/menu-planner/search-view.ts`), whatever its category.

## Goals / Non-Goals

**Goals:** reject requests that only ask for desserts, breakfasts or drinks, with a message that says what the menus hold, and measure both the hits and the false rejections.

**Non-Goals:** a dish-type field in the catalog (discussed with the author on 2026-10-23: every dish would have the same type, so the field would hold the same fact as the prompt); pieces (2) and (3) of «Decir "no hay"» (verifier LLM, percentage on the card), which stay future work; a rejection for a partly out-of-catalog request.

## Decisions

### D1. One category, `out-of-catalog`, with no subtype

The rejection keeps its shape, a closed enum, with one value more. Alternative: a subtype (`dessert | breakfast | drink`) so that the message names what was asked ("No hay postres en los menús", the example of `context/roadmap.md` MF-71). Rejected: it turns the rejection into an object in the port, the golden set and the evaluation, and the evaluation would have to score the subtype too, for a small gain in the wording. **Deviation from the roadmap example:** the message names the three kinds at once.

### D2. Only a request that asks for nothing else is rejected

"Cenas con lentejas y de postre fruta" still asks for something the menus have, so it is a search, labelled as it is said (labelling-guide rule 8). Rejecting it would lose a valid search; the out-of-catalog part only weakens the score. The prompt and the labelling guide say so in the same words.

### D3. Trap requests are a new origin, `catalog-trap`, written by the author from the catalog

The traps must name dishes that exist, so they cannot be generated blind like the rejected requests: the author picks them from the dish names of the catalog (`data/`, local only), with the two of the roadmap as a start. They are search requests with their own origin so that the composition can count them and the validator can require at least one constraint. The evaluation needs no new code for them: a rejected search request is already "rejected by mistake" (spec `decomposer-evaluation`, "Rejections").

### D4. The five new rejected requests are generated blind, as X01–X10

Same procedure and another-family LLM as `evals/decomposer/rejected-requests.md` (MF-40.1), with a prompt that asks for desserts, breakfasts and drinks only. The prompt and the unedited candidates go into that file. This keeps the prompt of the decomposer from being tuned on its exam: its new example is written separately and the existing test checks it is not in the golden set.

### D5. The category list gets one source in `src/`

Small refactor inside this change (PROC-sdd): `REJECTION_CATEGORIES` is exported next to `RejectionCategory` in `src/application/dto/decomposition.ts`, the type derives from it, and the port, the evaluation and the golden set reader import it. `evals/decomposer/golden-set-schema.ts` keeps its own list, as it keeps its own constraint schema (MF-13 design D4), and its tests catch a drift.

### D6. The message lives in the planner view, chosen by category

`toFailedState` picks the `out-of-catalog` message when the error is a rejection with that category, and the generic one otherwise. The outcome kind stays `rejected`, so nothing changes for the action, the breadcrumbs or Sentry.

## Risks / Trade-offs

- [The model rejects searches that sound like breakfast or dessert, "tostadas", "crema", "agridulce"] → the traps measure it; the report lists them as rejected by mistake. If a trap fails, the prompt is reviewed with new examples that are not in the golden set.
- [The rule is tied to this catalog: with menus that had desserts, it would be wrong] → declared as a limitation in the presentation; the category description in the prompt says what the menus hold, so a new catalog changes one sentence.
- [Trap ids join the decomposer golden set, which the search evaluation also reads as expected structures] → check in apply that `evaluate-search` only takes the structures of retrieval queries; if not, it filters by origin.
- [Five requests is a small sample] → the report already says that small counts are small samples.

## Migration Plan

No data migration. The evaluation is re-run after the prompt change, and `evals/decomposer/results.md` is replaced with the new report.
