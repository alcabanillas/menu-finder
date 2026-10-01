## Context

See `proposal.md` for the motivation. Constraints that shape the approach:

- **Hexagon (ADR-001):** `domain` imports nothing outside `domain` and `shared`, not even libraries. `cli` imports only `composition/cli-container`, application DTOs and use cases. A port exists only at a real external boundary: here the database and the embedding service. The CLI is the primary adapter; there is no web adapter in this change.
- **Data:** 36 menus, 14 meals each, 608 menu dishes (591 with a recipe file, 17 without), 424 distinct dish names, 434 recipes of which 414 are used by a menu (measured on `data/menu-platos.json` and `data/recetas.json`). The 17 dishes without recipe have 14 distinct names, so the database gets 448 recipe rows. One recipe file serves two dish names; no dish name maps to two files.
- **Neon:** project `menu-finder` in `aws-eu-central-1`, Postgres 18, free plan, Data API off, Neon Auth off. The pooled `DATABASE_URL` and the direct `DATABASE_URL_UNPOOLED` are in `.env.local`. Extensions are installed by migration, not by hand.
- **Next changes:** `mf-42-menu-search` reads these tables and adds what the lexical match needs (D4 of that change); `mf-14-search-evaluation` only reads.

**Status of the decisions below:** all confirmed by the author (D2, D3 and D5 in task 1.1; D1 and D9, with the names of the new ports, use cases and adapters, in task 1.4). They are recorded in `context/decisiones.md` when the change is closed (task 8.1).

## Goals / Non-Goals

**Goals:**
- The database as one more adapter of the existing repository ports, with the ingestion use cases unchanged.
- Commands that can be re-run at no cost: no embedding call when nothing changed.
- Nothing that has to be redone in MF-16 or MF-17: the schema, the load of the recipe text and the RLS are the final ones.

**Non-Goals:**
- Search, scoring and its evaluation: `mf-42-menu-search` and `mf-14-search-evaluation`.
- Enrichment (food groups, `totalTimeMin`, season), user history, normalised ingredients: MF-16.
- The web adapter, a limited database role and the production deploy: MF-17, MF-20, MF-22.
- An index on the vectors (see D5), the three text variants of the ablation (MF-30).

## Decisions

### D1. Layout and ports: the database behind `MenuRepository` and `RecipeRepository`

**Decided by the author (2026-10-01), replacing the first version of this design.** The database is one more adapter of the two repository ports that MF-11 and MF-38 created for it. The use cases `ingestMenus` and `ingestRecipes` do not change.

```
application/
  ports/        MenuRepository, RecipeRepository   unchanged
                RecipeEmbeddingRepository           new
                EmbeddingsPort, MigrationRunner     new
  use-cases/    ingest-menus, ingest-recipes        unchanged
                embed-recipes                       recipe rows → Gemini → database
                migrate
infrastructure/
  json-file/    JsonFileMenuRepository, JsonFileRecipeRepository   unchanged
  postgres/     PostgresMenuRepository, PostgresRecipeRepository,
                PostgresRecipeEmbeddingRepository, pool, migration runner
  fan-out/      FanOutRepository<T>, one class for both ports       JSON first, then Postgres
  genkit/       EmbeddingsPort adapter
composition/    cli-container wires them
cli/commands/   migrate, embed (menu and recipes unchanged)
```

| Command | Use case | Reads | Saves through |
|---|---|---|---|
| `ingest recipes` | `ingestRecipes` | the PDFs (`DocumentSource`) | `FanOutRepository` (recipes): JSON, then Postgres |
| `ingest menu` | `ingestMenus` | the PDFs (`DocumentSource`) | `FanOutRepository` (menus): JSON, then Postgres |
| `ingest embed` | `embedRecipes` | the recipe rows (`RecipeEmbeddingRepository`) | `RecipeEmbeddingRepository` |

- **PDF → database is the real load.** The JSON files are still written, first, because the golden-set scripts (`pnpm evals:golden-set`, MF-12) read them and they let the author work without the database; nothing reads them back into the database (decided by the author on 2026-10-01).
- **The fan-out adapter** (`FanOutRepository<T>`, one generic class, since both ports are just `saveAll`) implements the port by calling the JSON adapter and then the Postgres one. When the second fails, the error says that the JSON file was written and why the database save failed (decided by the author on 2026-10-01). `RepositoryError` keeps its shape: the text goes in `reason`.
- **`RecipeEmbeddingRepository`** is the only new port besides the migrations and the embedding service. `documents(variant)` returns every recipe row (the rows of dishes without recipe included) with its title, its ingredient names and, when there is one, the model and the text of its stored vector; `saveAll(variant, embeddings)` upserts the vectors in one transaction. `embed` needs nothing else, so the repository ports get no read method.
- **The rows of the dishes without recipe** (`dish:<name>`, one per distinct name) are created by `PostgresMenuRepository`, because they only exist through a menu. Their key and the embedded text come from `domain/search-index/`.
- The read side of the search (`SearchIndex`) comes with `mf-42-menu-search`, kept separate so that `search` and `evaluate-search` never need write access; the composition root can hand them a read-only connection later (MF-17) without changing the use cases.

### D9. What a save writes

- **Upsert, never delete what was not received** (ING-cli-local, "idempotente por número de menú"; MF-11 design). `PostgresRecipeRepository.saveAll` inserts or replaces each recipe it receives with its ingredients. `PostgresMenuRepository.saveAll` replaces each menu it receives (its 14 meals and their dishes) and keeps the others. A recipe or menu that disappears from the PDFs stays in the database until a migration or a manual step removes it.
- **One transaction per save.**
- **Recipes first.** `menu_dish.recipe_key` references `recipe`, so the order is `ingest recipes` → `ingest menu` → `ingest embed` (decided by the author on 2026-10-01; the T0 runbook is updated). Before writing, `PostgresMenuRepository` checks the recipe files its menus point to. When some are missing it saves the menus that are complete and returns an error that names each menu, dish and file; the command exits 1.
- **Embeddings are only recomputed when their text or model changed.** `embed` builds the text of every recipe row, compares it with the stored one and sends only the new or changed ones to Gemini, all before its single write. Vectors of recipes that no longer exist go with their recipe (`ON DELETE CASCADE`).

### D2. PostgreSQL driver: `pg` (node-postgres)

**Confirmed by the author (2026-10-01).** The CLI needs transactions (saves, migrations), and the direct connection (`DATABASE_URL_UNPOOLED`) is what `pg` expects. It is the most widely used driver, with no native build step. The same driver works later from Vercel functions with the pooled URL.

*Alternatives:* `@neondatabase/serverless` (made for edge runtimes and HTTP queries; transactions need its WebSocket pool, more moving parts than this change needs); `postgres` (fewer users); Drizzle or Prisma (an ORM and a code generator for six tables and a handful of queries, and one more supply-chain surface, `context/safety-first.md` §2.5).

### D3. Migrations: numbered SQL files in `postgres/migrations/` and a runner of about 40 lines

**Confirmed by the author (2026-10-01).** `postgres/migrations/001-search-schema.sql`, at the repository root and not under `src/infrastructure/`, because a migration is SQL, not code of the hexagon. The runner lives in `infrastructure/postgres/` and reads that folder. Migrations are applied in order inside a transaction each, recorded in a `schema_migration` table (RLS on). A migration is plain SQL, so reviewing it is reading it. The skill-provided alternative, Drizzle Kit, adds a dependency and a second schema description for the same six tables.

### D5. Embeddings: `gemini-embedding-2` through Genkit, stored as `vector(3072)`, no index

**Model confirmed by the author (2026-10-01): `gemini-embedding-2`, not `gemini-embedding-001`.** Checked in the Gemini API documentation on 2026-10-01: `gemini-embedding-2` is the current stable model (released 2026-04-22, no shutdown date); `gemini-embedding-001` shuts down on 2028-05-14, names `gemini-embedding-2` as its replacement and is no longer on the pricing page. Their embedding spaces are incompatible, so starting with `gemini-embedding-2` avoids re-embedding later. Both give 3072 dimensions by default. The paid tier is required: on the free tier the content is used to improve Google's products (SEG-datos-nutricionista). A full load stays under 0.20 USD (448 texts, under 1M text tokens at 0.20 USD per 1M).

`gemini-embedding-2` has no `task_type` parameter for text: the task goes inside the text as a prefix (for example `task: search result | query: …`). Recipes are embedded as documents and terms as queries with that prefix; how the Genkit plugin passes it is checked in task 1.2. The model name and dimensions are stored with every vector, so that a model change is visible and forces a recompute. **Column type confirmed by the author (2026-10-01): `vector(3072)`.** 448 vectors are compared by an exact scan, which returns exact and repeatable results, as the evaluation of MF-14 needs; an HNSW index is approximate and would only pay off with far more rows. Per the pgvector README, a fixed dimension is the normal use (an untyped `vector` column is meant for several models in one column, which is not the case here), and the database rejects a vector of the wrong size. *Growth path, not built now:* an HNSW index on `vector` is limited to 2000 dimensions, so if the rows grow, a later migration adds a half-precision expression index (`USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)`, up to 4000 dimensions) without changing the column. *Alternatives:* `halfvec(3072)` (half the storage, but 16-bit precision changes the similarities slightly and the menu scores are compared to six decimals); untyped `vector` (no migration on a dimension change, but no size check).

**Checked on 2026-10-01 (task 1.2), in the npm registry and the Genkit and Gemini API documentation:**

| Package | Version | Source | Install scripts |
|---|---|---|---|
| `pg` | 8.23.1 | `github.com/brianc/node-postgres`, MIT, maintainer `brianc` | none |
| `@types/pg` (dev) | 8.23.1 | DefinitelyTyped | none |
| `genkit` | 1.42.0 | `github.com/genkit-ai/genkit`, Apache-2.0 | none |
| `@genkit-ai/google-genai` | 1.42.0 | same repo (`js/plugins/google-genai`), Apache-2.0, maintainers include `google-wombot`; peer `genkit ^1.42.0` | none |

- **Call:** `genkit({ plugins: [googleAI()] })` and `ai.embedMany({ embedder: googleAI.embedder("gemini-embedding-2"), content })`, with `googleAI` from `@genkit-ai/google-genai`. The plugin reads the key from `GEMINI_API_KEY`, the name already in `.env.local`; the adapter passes it explicitly (`googleAI({ apiKey })`) so that the composition root, not the plugin, decides where it comes from.
- **Task prefix:** the Gemini API documentation states that `gemini-embedding-2` does not support the `task_type` parameter, so the adapter does not pass `taskType` and writes the prefix itself: `title: {title} | text: {content}` for a document (`title: none` without a title) and `task: search result | query: {content}` for a query (used by `mf-42-menu-search`). For a recipe, `{title}` is the recipe title (or the dish name for a row with no recipe) and `{content}` the ingredient names joined by commas, or the title again when there are no ingredients, so that the text is never empty.

D4 (lexical match) is in `mf-42-menu-search`; the D numbering is kept from the design of the original, unsplit MF-14.

### D8. Tests

- Use cases with fake ports: `embed` sends only new or changed texts, never the preparation, and writes nothing when the service fails; errors without secrets. The tests of `ingestMenus` and `ingestRecipes` do not change, which is the proof that the use cases did not.
- Fan-out adapters with fake repositories: order, the JSON error stops before the database, the database error says that the JSON was written.
- Adapters (`infrastructure/`, no coverage threshold): integration tests against a **temporary Neon branch** created for the run, so that no test touches `production`. They run locally with `DATABASE_URL_TEST` and are skipped when it is not set; **CI does not run them in this change** (it has no database secret and `context/decisiones.md` §2 point 2 leaves the testing strategy open). The skip is printed, not silent.
- CLI commands: the existing `run-cli` test style (fake container).

## Risks / Trade-offs

- **One recipe file with two dish names** → the single embedding uses the recipe title. The effect is one dish out of 608.
- **Loading the preparation text** → it goes to Neon (decided in SEG-datos-nutricionista) and not to Gemini; a test asserts the text sent to the embedding service.
- **Owner role in the CLI** → by design (ADR-001 §2); the web gets a limited role in MF-17/MF-20, and RLS without policies already denies every other role.

## Migration Plan

1. `pnpm ingest migrate` creates the schema on the `production` branch of the Neon project (done on 2026-10-01 by the first version of this change, which also loaded the data; the schema does not change).
2. `pnpm ingest recipes`, `pnpm ingest menu` and `pnpm ingest embed`, in that order, bring it in line with the PDFs; the second run of `embed` computes nothing.
3. Rollback: the saves are upserts, so running the ingestion again restores what is in the PDFs; for the schema, a new migration drops what it must. No data is lost that is not in `data/`.
