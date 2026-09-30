# Decomposer golden set: labelling guide

Rules for labelling the expected structure of each request in `golden-set.json` (MF-13, spec `decomposer-golden-set`). The same text is the prompt of the drafting LLM, the reference for the author's review and the meaning MF-28 relies on.

The schema is **minimal**: it only holds what BUS-superficie-consulta already decides. Concepts, food groups and attribute parameters are not labelled here. They are fixed by the spike T3 and labelled in a later pass, declared non-blind.

## Format

```json
{
  "id": "C05",
  "text": "arroz sin carne",
  "origin": "retrieval-golden-set",
  "constraints": [
    { "id": "c1", "type": "literal", "term": "arroz", "polarity": "include", "hard": false },
    { "id": "c2", "type": "exclusion", "term": "carne", "polarity": "exclude", "hard": false }
  ],
  "sameDish": [["c1", "c2"]],
  "anyOf": []
}
```

- `origin`: `retrieval-golden-set` for a query reused from `evals/retrieval/queries.json` (same `id` and `text`), `llm-blind` for a long request `R01`–`R07`.
- `sameDish` and `anyOf` are lists of groups of constraint ids (rule 1). A request has both, empty when it has no group.
- A constraint has `id` (`c1`, `c2`… within the request), `type`, `term`, `polarity`, `hard` and, optionally, `slot` (`lunch` or `dinner`). No other field.

## Rules

The label is the author's reading of the request in context: the decomposer is an LLM that reads in context too. The rules below are the default for clear cases. When a request is ambiguous, the chosen reading is listed in *Known ambiguous cases*, so MF-28 can report those requests apart.

1. **One constraint per condition.**
   - "y" separates constraints: "pollo y arroz" → two.
   - "ni" splits an exclusion: "sin pescado ni marisco" → two.
   - "con" joins constraints that one dish must satisfy: they go in a `sameDish` group.
   - "o" joins alternatives, any of which satisfies the condition: "garbanzos o lentejas" → two constraints in an `anyOf` group. Only included constraints go in it: in an exclusion, "o" splits like "ni" ("sin gluten o lactosa" → two exclusions, no group).
   - A constraint is in at most one group of each kind, and never in both kinds: "o" inside "con" ("arroz con pollo o pescado") is not labelled yet (T3 decides it).
2. **`term`** is the shortest span of the request that states the condition, lowercased and copied as written ("carne roja", not "evitar la carne roja"; "alitas de pollo", not "pollo").
   - Slot words are not part of it: "cenas rápidas" → term `rápidas`, slot `dinner`.
   - When the slot is the whole condition ("para cenar"), the term is that span.
3. **`type`**, after the four mechanisms of BUS-superficie-consulta (d):

   | Type | When | Examples |
   |---|---|---|
   | `literal` | A concrete dish or ingredient, included | "merluza", "alitas de pollo", "sardinas en lata" |
   | `exclusion` | An excluded ingredient or food group, which the group table resolves (a group of `evals/retrieval/ingredient-groups.json`, base or derived). Polarity always `exclude` | "sin cerdo", "sin pescado", "vegetariano", "nada de queso" |
   | `attribute` | Time, effort, season or slot | "rápidas", "fáciles", "para el invierno", "para cenar" |
   | `fuzzy` | A vague intention, or a hypernym that no group resolves, included or excluded | "de cuchara", "ligero", "marisco" → `include`; "nada de fritos", "sin pescado crudo" → `exclude` |

   A hypernym that is also a food group ("pescado", "marisco", "carne", "legumbres", "verduras", "pasta") is `fuzzy` when included ("pescado y verduras") and `exclusion` when excluded ("sin pescado").
4. **Exclusion scope** (BUS-superficie-consulta (b)).
   - An exclusion attached to a noun ("arroz sin carne", "pasta sin queso") goes in a `sameDish` group with that noun: it applies to the dish.
   - A standalone exclusion ("sin cerdo", "nada de cerdo", "vegetariano") stays out of groups: it applies to the week.
   - An exclusion after a coordination ("pollo y brócoli sin pescado") cannot be tied to one item, so it applies to the week. It is tied to a dish only inside one item, right after its noun ("arroz sin carne, pollo y…"). The request is ambiguous, and this reading matches the retrieval golden set (MF-12), which grades C07 and C10 on the whole week.
5. **`hard`** is `true` only with an explicit marker of strictness ("solo", "sí o sí", "nada de nada", "estrictamente", "que no haya ni uno"). Otherwise it is `false`: soft is the default.
6. **`slot`**: "comida" sets `lunch` only when it means the meal ("comidas rápidas"), not food in general ("comida reconfortante", "comida casera"). "cena" sets `dinner`. A slot applies to the constraint it qualifies; a slot that qualifies the whole request goes on every constraint.
7. **Empty list.** A request that none of the four types can hold ("platos para el finde") has `"constraints": []`, `"sameDish": []` and `"anyOf": []`. It is a negative case for the decomposer.
8. **Label what is said, not what is meant.** Do not add constraints the request does not state, do not normalise synonyms ("alitas" stays "alitas"), and do not guess a group.

## Known ambiguous cases

Requests that two reasonable readers label differently. The label holds the chosen reading.

| Id | Ambiguity | Chosen reading | Why |
|---|---|---|---|
| C07 | "pollo y brócoli sin pescado": the exclusion on the broccoli dish or on the week | Week (rule 4) | Matches the retrieval golden set (MF-12), and Gemini, the engine's model, read it the same way when asked without context |
| C10 | "huevos y verduras sin carne": same as C07 | Week (rule 4) | Same as C07 |
| R05 | "comidas de cuchara": "comidas" as the lunch slot or as food in general | No slot (rule 6) | The author's reading: the request asks for spoon dishes, not for lunches |

## Prompt: generation of the long requests

Used in a separate conversation, with no access to the dataset.

> You are helping build an evaluation set for a search engine over 36 weekly home menus (lunch and dinner, Monday to Saturday) written by a nutritionist, in Spanish. A user types a request in natural language to choose the menu for the week.
>
> Write 15 realistic requests in Spanish, the way a person would type them on a phone. Each one must combine at least three conditions of at least two kinds among: a concrete dish or ingredient to include; an ingredient or food group to exclude; time, effort, season or meal (lunch/dinner); a vague intention ("de cuchara", "ligero", "que guste a los niños"). Vary the structure: use "y", "con", "sin", "nada de", "ni"; mix exclusions that apply to one dish ("arroz sin carne") with exclusions for the whole week ("nada de cerdo"); include at least two requests with an explicit strictness marker ("sí o sí", "solo"). Do not ask about anything else (no recipes, no quantities, no prices).
>
> Return a numbered list, one request per line, nothing else.

## Prompt: drafting the structures

> Label each request below with its expected structure, following the labelling guide exactly (format and rules above). Return a JSON array with one object per request, in the given order, with `id`, `text` and `origin` copied as given. Label only what the text states. Do not add fields.
>
> Requests: (the 61 requests, as `{ id, text, origin }`)

## Changes to the rules after the draft

Any rule the review changes is fixed here first, with the date and the requests it affects.

- **2026-09-30, rule 4:** added the case of an exclusion after a coordination (week, not dish). It makes explicit the reading the draft already applied, so no request changes. Affects C07 and C10.
- **2026-09-30, rule 3:** "group" now means a group of `evals/retrieval/ingredient-groups.json`. The guide listed "marisco" as a hypernym with no group, but that table has it. E04 "marisco" changes from `fuzzy` to `exclusion`; F02 ("marisco" included) stays `fuzzy`.
- **2026-09-30, rules intro:** the author's reading in context wins over a rule, and ambiguous requests are listed in *Known ambiguous cases*. R05 loses the slot `lunch`; C07 and C10 do not change.
