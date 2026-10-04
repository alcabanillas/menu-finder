## Why

Roadmap item **MF-42**, second of three changes (`mf-41-search-index` → `mf-42-menu-search` → `mf-14-search-evaluation`). With the dataset and its embeddings in Neon (`mf-41-search-index`), this change builds the search itself. The comparison *lexical vs. semantic vs. hybrid, per query type* (EVAL-estrategia, pillar 2 of the presentation) needs one search that runs with the three strategies; `mf-14-search-evaluation` measures it.

The search is built as **final code on the hexagon**, not as a throwaway spike (it replaces the T3 spike of the old roadmap). It takes the typed structure of a request, not the text: the decomposer that turns text into structure is a separate change (MF-40).

## What Changes

- **Search use case** (`searchMenus`): receives the typed structure that the decomposer will emit, the expected output of the golden set of MF-13 (constraints, `sameDish` and `anyOf` groups, without the golden-set metadata), scores the 36 menus, returns the **top 5** and, for each hard constraint, how many menus it removes (the UI chip shows it, BUS-descomponedor). It runs with three strategies, `lexical`, `semantic` and `hybrid`.
- **Lexical match in Postgres:** a migration adds what the full-text match needs on top of the schema of `mf-41-search-index`.
- **CLI:** `pnpm ingest search <structure.json> [--strategy lexical|semantic|hybrid]` runs a search.
- **No LLM at search time** except the embedding of a term. No decomposer, no relaxation loop (future work, `context/producto.md` §3), no enrichment (MF-16: food groups, `totalTimeMin`, season), no evaluation, no user interface.

## Capabilities

### New Capabilities
- `menu-search`: given a typed structure, score the 36 menus with a strategy and return the top 5 plus the menus each hard constraint removes.

### Modified Capabilities

None.

## Impact

- **Code:** `src/domain/search/`, `src/application/` (use case `search-menus`, DTOs `search-request` and `search-result`, a read method added to `MenuRepository` and another to `RecipeEmbeddingRepository`, and the new port `DishTextSearch`), `src/infrastructure/postgres/` (the adapters of those three, migration `003`), `src/infrastructure/genkit/` (query task prefix), `src/composition/cli-container.ts`, `src/cli/commands/`.
- **Dependencies:** none new; it uses the driver and Genkit added by `mf-41-search-index`.
- **Systems:** Neon (read only); Gemini API receives the constraint terms to embed.
- **Config:** the database URL and `GEMINI_API_KEY` in `.env.local` (git-ignored). No secret in the repo.

### Data touched (SEG-datos-nutricionista)

The search reads dish names and ingredients from Neon and prints the evidence dish of each returned menu to the local console. Constraint terms leave to the Gemini API to be embedded. Nothing is written to the database or to the repo.

### Possible abuses and OWASP 2025 (SEG-owasp, `context/OWASP-Top10.md`)

There is no endpoint and no user in this change: it is a local CLI. The abuses that remain are about the input structure, the secrets and the quota.

| Category | Abuse | Control |
|---|---|---|
| A05 Injection | A `term` with SQL or `tsquery` metacharacters, or Unicode that breaks the query | Every query is parameterised; the term is never concatenated and is never read as `tsquery` syntax. Zod validates the structure with length and count limits. Scenarios in `menu-search`. |
| A04 Cryptographic failures | Secrets in logs or in error messages | Connection string and key only from the environment; errors never echo them. A test checks the error text. |
| A06 Insecure design | A huge structure that exhausts the API quota or the memory | Limits on constraints, groups and term length; at most one embedding call per distinct term and run. |
| IA and RAG | The term goes to the embedding model | It is data, not instructions: an embedding has no instruction channel. No generated text reaches a query. |

### Decisions it relies on

BUS-superficie-consulta (a) to (f), BUS-descomponedor, BUS-unidad-plato, BUS-vector-derivado, ARQ-hexagonal, IA-proveedor, IA-criterio-agente, SEG-owasp, OPS-calidad.

### Deviations and consequences

- **BUS-superficie-consulta (c) and (d):** the exclusion, attribute and season mechanisms depend on the enrichment (MF-16). Without it, an exclusion matches the term by text, and an attribute query ("cenas rápidas", "para el invierno") can only be answered by the semantic part. `mf-14-search-evaluation` reports how far that goes per type. Not a contradiction: it is the measurement that decides.
- **IA-criterio-agente:** the search is a pipeline, not an agent. The decomposer stays an agent only if the relaxation loop comes back (`context/producto.md` §3).
- **Existing ports extended:** the dish catalog is read through `MenuRepository` and the similarities through `RecipeEmbeddingRepository`, which only had write methods until now; only `DishTextSearch` is a new port (`design.md` D1). `MenuRepository` is also what MF-43 needs to list the menus, so the method is shared.
- **Migration number:** `003`, because `002` is reserved for a parallel change that touches other tables.
- **Declared limitations:** (1) the hybrid weight is fixed before looking at results, so it is not tuned on the golden set; (2) semantic scores are calibrated per constraint, not globally.
