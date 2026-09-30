# Decomposer golden set: long requests

The long requests `R01`–`R07` of `golden-set.json` (`origin: llm-blind`). They were generated blind with the generation prompt of `labelling-guide.md`, in a separate conversation with no access to the dataset (MF-13, design D5).

## Candidates (unedited)

As returned by the LLM:

1. Quiero una semana con lentejas y pescado, sin cerdo y con cenas ligeras.
2. Busca menús de cuchara, con garbanzos o lentejas, nada de carne roja y que sean fáciles de hacer.
3. Para las cenas quiero algo ligero, con verduras y pescado, sin fritos ni platos muy pesados.
4. Que haya arroz sin carne, pollo y alguna legumbre, pero nada de cerdo durante la semana.
5. Una semana que guste a los niños, con pasta y pollo, sin pescado y con cenas rápidas.
6. Quiero comidas de invierno de cuchara, con legumbres, sin pescado ni marisco y que no sean complicadas.
7. Para comer, platos con verduras y pescado, sin carne de cerdo, y que sean ligeros.
8. Solo quiero una semana con pollo y legumbres, sin pescado ni marisco, y con cenas fáciles.
9. Necesito un menú de verano, con gazpacho y ensaladas, sin platos pesados y con cenas ligeras.
10. Que tenga arroz y pescado, nada de carne roja, y que las cenas sean rápidas y ligeras.
11. Quiero sí o sí alguna receta con garbanzos, sin cerdo en toda la semana y con comidas de cuchara.
12. Para las cenas, nada de fritos ni carne, con verduras y tortilla, y que sea fácil de preparar.
13. Una semana con pasta y pollo, sin pescado, con comidas que gusten a los niños y cenas ligeras.
14. Solo menús con legumbres y verduras, nada de cerdo ni fritos, y mejor para días fríos.
15. Quiero arroz sin carne, pescado sí o sí, nada de cerdo y cenas que sean ligeras.

## Selection

The author kept 7 candidates, unedited. They were chosen so that together they cover every rule of the guide. The others repeat a structure already covered (1, 10, 13, 15 and 5, whose vague intention and one-constraint slot are in 2, 7 and 9), or add nothing new (3, 6, 8).

| Id | Candidate | What it tests |
|---|---|---|
| R01 | 2 | "o" (`anyOf`), "de cuchara", and a "con" that does not mean the same dish ("menús… con garbanzos") |
| R02 | 4 | A dish exclusion ("arroz sin carne") next to a week exclusion ("nada de cerdo") |
| R03 | 7 | "Para comer" as the slot of the whole request |
| R04 | 9 | Season, a concrete dish and an excluded vague intention ("sin platos pesados") |
| R05 | 11 | "sí o sí" (`hard`) and "comidas de cuchara" |
| R06 | 12 | "ni", and "Para las cenas" as the slot of the whole request |
| R07 | 14 | "Solo" (`hard`), "ni" and "días fríos" |

The texts go into `golden-set.json` as written above.

## Review

The author reviewed `golden-set.json`, a copy of `draft.json` (MF-13, design D5):

- **In detail**, the 13 requests where the drafter flagged a choice the guide did not settle: E01, E04, C07, C10, C11, R01, R03, R04, R05, R06, R07, A03, A04. They led to three changes in the guide (see *Changes to the rules after the draft*).
- **Quickly**, the other 48, on a compact view of the labels. Most are one-constraint queries (L, E, A, F). This is the anchoring bias the proposal declares, at its strongest.

Requests edited in the review, from the diff between `draft.json` and `golden-set.json`:

| Origin | Requests | Edited | Unchanged |
|---|---|---|---|
| `retrieval-golden-set` | 54 | 1 (E04: "marisco" `fuzzy` → `exclusion`) | 53 |
| `llm-blind` | 7 | 1 (R05: slot `lunch` removed) | 6 |
| **Total** | **61** | **2** | **59 (96.7 %)** |

Both edits come from a rule of the guide that the review changed or made explicit, not from a draft that broke a rule.
