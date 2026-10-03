## Why

Roadmap item **MF-14**, third of three changes (`mf-41-search-index` → `mf-42-menu-search` → `mf-14-search-evaluation`). The comparison *lexical vs. semantic vs. hybrid, per query type* (EVAL-estrategia, pillar 2 of the presentation) decides whether the vector store stays (MF-19) and what the ingestion must enrich (MF-16). The search exists (`mf-42-menu-search`) and both golden sets (MF-12 retrieval, MF-13 decomposer) exist, so this change measures it.

## What Changes

- **CLI:** `pnpm ingest evaluate-search` runs the three strategies on the structures of `evals/decomposer/golden-set.json` and measures them against the grades of `evals/retrieval/golden-set.json`, per query type, with nDCG@5 and hit@5.
- **Report:** the result is committed as `evals/search/results.md` (ids and metrics only).
- No LLM-as-judge, no ablations (MF-30), no change to the search.

## Capabilities

### New Capabilities
- `search-evaluation`: the command that measures the three strategies against the golden sets, per query type, and the report it writes.

### Modified Capabilities

None.

## Impact

- **Code:** `src/domain/search/` (metrics), `src/application/` (use case `evaluate-search`, port `GoldenSetSource`, DTO `evaluation-report`), `src/infrastructure/golden-sets/`, `src/composition/cli-container.ts`, `src/cli/commands/`.
- **Dependencies:** none new.
- **Systems:** Neon (read only); Gemini API receives the constraint terms of the golden set to embed.
- **Files:** `evals/search/results.md`, committed.

### Data touched (SEG-datos-nutricionista)

The evaluation reads the dataset from Neon and the golden sets from `evals/`. The report keeps ids and metrics, never dish or ingredient text, because the repo is public. The per-query detail (which dish ranked) is printed to the local console, not saved.

### Possible abuses and OWASP 2025 (SEG-owasp, `context/OWASP-Top10.md`)

There is no endpoint and no user in this change: it is a local CLI over files of the repo.

| Category | Abuse | Control |
|---|---|---|
| A04 Cryptographic failures | Secrets in logs, in the report or in error messages | Connection string and key only from the environment; errors never echo them. |
| A06 Insecure design | A golden set that makes many embedding calls | Each distinct term is embedded once per run; the golden structures are validated with the limits of `menu-search`. |
| Data exposure | Nutritionist text in the committed report | The report has ids, types, strategy names and numbers only; a test checks it against the names of the fake dataset. |

### Decisions it relies on

EVAL-estrategia, EVAL-golden-sets, BUS-superficie-consulta (d), BUS-descomponedor, SEG-datos-nutricionista, ARQ-hexagonal, OPS-calidad.

### Deviations and consequences

- **Declared limitations:** (1) with 36 menus and 43 queries the per-type differences are small samples (7 to 10 queries per type), and the report says so; (2) none of the 43 kept queries has a `hard` constraint or an `anyOf` group, and only three have a `sameDish` group, so the table says nothing about the hard filters or the alternatives: those are covered only by the unit tests of `mf-42-menu-search`.
