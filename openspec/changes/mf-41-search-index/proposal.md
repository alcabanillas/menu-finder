## Why

Roadmap item **MF-41**, first of three changes (`mf-41-search-index` → `mf-42-menu-search` → `mf-14-search-evaluation`). The original MF-14 was split into MF-41, MF-42 and MF-14 so that each part is reviewed and archived on its own. The product is a search over 36 weekly menus, and nothing of it exists yet: there is no database, no scoring and no measurement. This change puts the dataset and its embeddings in Neon, which the search (`mf-42-menu-search`) and its evaluation (`mf-14-search-evaluation`) need. It also settles the technical risk early: `pgvector`, full-text search in Spanish and Genkit embeddings.

## What Changes

- **Database in Neon** (project `menu-finder`, branch `production`): `pgvector` and the minimal model of ARQ-modelo-datos for search: `menu` → `meal` → `menu_dish`, `recipe`, `recipe_ingredient`, `recipe_embedding`. Applied by SQL migrations (`pnpm ingest migrate`). Row-level security is enabled on every table from the first migration.
- **Load command** (`pnpm ingest load`): reads `data/menu-platos.json` and `data/recetas.json`, writes them to Neon idempotently and computes the embeddings with Gemini through Genkit. The recipe text is loaded whole (title, times, ingredients and preparation), because the recipe card (MF-23) needs it and loading twice is rework. The parsers already drop the brand, the contact block and the footer by position (T2 §4, verified on 639 PDFs in MF-38), so no brand cleaning is needed here.
- No search, no evaluation, no enrichment (MF-16: food groups, `totalTimeMin`, season), no user interface.

## Capabilities

### New Capabilities
- `search-index`: the database schema and the load of the dataset and its embeddings from the local JSON files, idempotent and transactional.

### Modified Capabilities

None.

## Impact

- **Code:** `src/application/` (use cases `migrate` and `load-search-index`, ports `SearchIndexWriter`, `EmbeddingsPort` and `DatasetSource`), `src/infrastructure/postgres/` (pool, migration runner, writer adapter), `postgres/migrations/` (SQL, at the repository root), `src/infrastructure/genkit/`, `src/infrastructure/json-file/` (`DatasetSource`), `src/composition/cli-container.ts`, `src/cli/commands/`. `scripts/` is untouched.
- **Dependencies (new, each justified in `design.md`):** a PostgreSQL driver, Genkit and its Google plugin. `@neon/config` and `@neon/env` are already installed.
- **Systems:** Neon (schema and data written with the owner role, from the CLI only); Gemini API (paid tier, so the content is not used to improve Google products) receives dish names and ingredient names to embed.
- **Config:** `DATABASE_URL_UNPOOLED` and `GEMINI_API_KEY` in `.env.local` (git-ignored). No secret in the repo.

### Data touched (SEG-datos-nutricionista)

Dish names, ingredients, times and preparation text of the nutritionist now go to Neon (decided in `context/decisiones.md` §1.8, SEG-datos-nutricionista: names and ingredients are facts, and the preparation is loaded for the recipe card). Brand, email, slogan and footer do not exist in the JSON (T2 §4). Dish names and ingredients leave to the Gemini API to be embedded; the preparation text does not.

### Possible abuses and OWASP 2025 (SEG-owasp, `context/OWASP-Top10.md`)

There is no endpoint and no user in this change: it is a local CLI. The abuses that remain are about the input files, the secrets and the supply chain.

| Category | Abuse | Control |
|---|---|---|
| A05 Injection | A dish or ingredient name with SQL metacharacters | Every query is parameterised; no value is concatenated. Zod validates both input files. |
| A02 Misconfiguration | A table reachable without the owner role; Data API on | RLS on every table with no policy (only the owner role, used by the CLI, reads and writes); the Data API stays off (checked in Neon). |
| A04 Cryptographic failures | Secrets in logs, in the repo or in error messages | Connection string and key only from the environment; errors never echo them. A test checks the error text. |
| A03 Supply chain | A look-alike or abandoned package for the driver or Genkit | Each dependency is checked on npm before it is added (`context/safety-first.md` §2.5) and justified in `design.md`. |
| A03 Supply chain | Known vulnerabilities in Genkit's transitive dependencies | Accepted, see below. |
| A10 Exceptional conditions | A failure half-way through the load leaves a partial dataset | The load is one transaction; a failed embedding call aborts it. |

### Accepted risk: vulnerable transitive dependencies of Genkit

`genkit@1.42.0`, the latest version, brings four advisories through dependencies it pins: GHSA-q7rr-3cgh-j5r3 and GHSA-45rx-2jwx-cxfr (high), GHSA-8988-4f7v-96qf and GHSA-w5hq-g745-h8pq (moderate), in `@opentelemetry/sdk-node`, `auto-instrumentations-node`, `propagator-jaeger`, `core` and `uuid`. The author accepted them on 2026-10-01:

- **They cannot be patched from here.** The fixes are new major versions (`@opentelemetry/core` 2.x, `uuid` 11+), while Genkit pins `core ~1.25` and `sdk-node ^0.52`. Forcing them with `pnpm` overrides was tried: Genkit then fails to load (`core_1.getEnv is not a function`). Dropping Genkit only postpones them, because the decomposer (MF-40) needs it.
- **None is reachable in this change.** The Prometheus exporter and the Jaeger propagator are only active when configured, and Genkit configures neither; W3C Baggage needs incoming HTTP requests, and the CLI receives none; `uuid` is only called as `v4()` without a buffer. Reasons per advisory in `osv-scanner.toml`, which makes the CI scanner ignore exactly these four.
- **Dependabot:** its alerts do not read `osv-scanner.toml`. Once this change reaches `main`, the author dismisses the four alerts in GitHub with the reason "Vulnerable code is not actually used" and a link to this section. Replacing Genkit with `@google/genai` was considered and rejected on 2026-10-01: it would remove the alerts, but rebuilding the traces of OPS-observabilidad by hand costs hours the plan does not have.
- **Conditions:** never enable the Prometheus exporter or the Jaeger propagator. Review again in MF-40 and MF-22, when Genkit runs in the decomposer and behind HTTP on Vercel, and drop each exclusion as soon as Genkit ships the fix.

### Decisions it relies on

BUS-unidad-plato, BUS-vector-derivado, ARQ-hexagonal, ARQ-modelo-datos, IA-proveedor, EVAL-golden-sets (the `variant` of the embedding), SEG-datos-nutricionista, ING-cli-local, OPS-calidad.

### Deviations and consequences

- **IA-proveedor (changed by this proposal):** the embedding model goes from `gemini-embedding-001` to `gemini-embedding-2`, confirmed by the author on 2026-10-01. Why: `gemini-embedding-2` is Google's current stable model and the named replacement of `gemini-embedding-001`, which shuts down on 2028-05-14 and is no longer on the pricing page; the two embedding spaces are incompatible, so starting with the new one avoids re-embedding later. The embeddings use the paid tier, because on the free tier Google uses the content to improve its products (SEG-datos-nutricionista). Detail in `design.md` D5; `context/decisiones.md` §1.6 is already updated.
- **ARQ-modelo-datos:** only the tables search needs are created. `Ingredient`, `FoodGroup`, `ShoppingItem`, `Selection` and the Better Auth tables come with MF-16, MF-24 and MF-20. Ingredients are stored as text per recipe; MF-16 normalises them. No contradiction, a subset.
