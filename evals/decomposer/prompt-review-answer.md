# Blind review of the decomposer prompt: answer and verdicts (MF-40.3)

After the first run of `pnpm ingest evaluate-decomposer` (`results-before-prompt-review.md`), the prompt of the decomposer was reviewed by an LLM of another family. It got `prompt-review-request.md` only: the prompt and the "Format" and "Rules" sections of `labelling-guide.md`, with no request of the golden set, no result and none of our findings. It was asked for the places where the prompt does not match the guide.

## Verdicts (decided by the author on 2026-10-11)

| Item | What the review found | Verdict |
|---|---|---|
| 1.1 | The broad food categories of rule 3 miss "marisco" and "pasta" | Applied for "pasta". "marisco" cannot be named: it is a request of the golden set, and the blind test of the prompt refuses it |
| 1.2 | The prompt does not say when an excluded term is `exclusion` and when `fuzzy` | Applied with other wording: a way of cooking or preparing is `fuzzy`. The prompt cannot point to the group table, which the model does not have |
| 1.3 | A diet ("vegano") excludes a group with no negating word | Applied |
| 1.4 | The strictness marker "que no haya ni uno" is missing | Applied |
| 1.5 | Rule 1: "o" inside "con" makes no group | Applied |
| 1.6 | Rule 8: do not add constraints, do not guess a group | Applied |
| 1.7 | Rule 2: the negating words are not part of the term | Applied |
| 2.1, 2.2 | A rejection should have the `rejection` key only, and a search no `rejection` key | Rejected: the review mixes up the format of the golden-set file with the answer of the model. The answer schema of the decomposer port always has the four keys (spec `request-decomposer`), and the evaluation compares meanings, not keys |
| 3.1 to 3.3 | Wording of the guide: "marisco" in the `fuzzy` row, the Format section and rule 9, an excluded ingredient that is not a group | Not applied here: they change the wording of the guide, not a label |

## What the review did not find

Rule 2 asks for the shortest span ("invierno"), and the `attribute` row of rule 3 gives "para el invierno" as an example. The prompt follows the example ("para el verano"), and most `attribute` misses of the first run come from there. The review did not report it, so it was not changed: a change found by reading the results would not be blind.

## The answer of the review, condensed

1. Rules of the guide that are missing from the prompt
1.1. Incomplete list of dual-behavior food categories (`marisco` and `pasta`). Prompt line: `A broad food category ("pescado", "carne", "legumbres", "verduras") is fuzzy when included and exclusion when excluded.` Guide rule (Rule 3): `A hypernym that is also a food group ("pescado", "marisco", "carne", "legumbres", "verduras", "pasta") is fuzzy when included ("pescado y verduras") and exclusion when excluded ("sin pescado").` What to change: The prompt omits `"marisco"` and `"pasta"`. Update the prompt line to include all six categories.

1.2. Criterion for `exclusion` vs. `fuzzy` based on the group table. Prompt lines: `- exclusion: an excluded ingredient or food group.` and `- fuzzy: a vague intention or a broad category, included ("que llene", "de horno") or excluded ("nada de rebozados").` Guide rule (Rule 3): the `exclusion` row says the group table resolves it, and the `fuzzy` row covers a hypernym that no group resolves ("nada de fritos", "sin pescado crudo" → exclude). What to change: clarify that `exclusion` is an ingredient or a food group resolved by the ingredient groups table, and `fuzzy` a vague intention, culinary technique, preparation, or a category the table does not resolve, included ("al vapor") or excluded ("nada de precocinados").

1.3. Dietary preference terms (`vegetariano`) and implicit negative polarity. The prompt's polarity rule only lists negating words, so a diet would be `include`. Add: dietary restrictions that exclude food categories implicitly (e.g., "vegano") are type exclusion with polarity exclude, even without an exclusion particle.

1.4. Strictness marker `"que no haya ni uno"` for `hard: true` (Rule 5): add it to the list of the prompt.

1.5. Conflict handling for "o" inside "con" (Rule 1): when "o" occurs inside a "con" phrase, neither `sameDish` nor `anyOf` is created for those constraints.

1.6. Negative constraints from Rule 8: do not infer or add constraints that the request does not explicitly mention, and do not guess group relationships unless the connectors join them.

1.7. Exclusion triggers must not be included in `term` (Rule 2): negation words and governing verbs ("sin", "nada de", "evitar") are not part of the term: for "evitar el cordero", the term is "cordero".

2. Instructions or examples of the prompt that contradict a rule of the guide
2.1. Structural schema of rejected requests: the guide says a rejected request has the rejection category and nothing else, while the prompt asks for empty `constraints`, `sameDish` and `anyOf`. Proposed: a rejection outputs only the `rejection` key, with the new example "qwrtyp" → `{"rejection":"gibberish"}`.

2.2. Inclusion of `"rejection": null` in valid search outputs: the guide's format has no `rejection` key for a search. Proposed: remove `Otherwise rejection is null` and the key from the search examples.

3. Contradictions inside the guide itself
3.1. Status of `marisco` in Rule 3: the `fuzzy` row uses "marisco" as a hypernym that no group resolves, while the paragraph below lists it as a food group. Proposed: replace "marisco" in the `fuzzy` row with a category that is not a group.

3.2. Mandatory presence of `sameDish` and `anyOf` in Format vs. Rule 9: Format says every request has both, rule 9 says a rejected request has nothing else. Proposed: "A non-rejected request has both sameDish and anyOf, empty when it has no group. Rejected requests omit both (rule 9)."

3.3. Definition of `exclusion` vs. concrete individual excluded ingredients: an excluded concrete ingredient that is not a group cannot be `literal` (included only) nor `exclusion` (resolved by the group table) under the strict wording. Proposed: "An excluded ingredient, or an excluded food group that the group table resolves. Polarity always exclude."
