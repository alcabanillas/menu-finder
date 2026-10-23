## Why

Cosine similarity over full recipe documents (`title` + `ingredients`) mixes dish titles and ingredients into one vector (`embedding_v2`), which causes two systematic retrieval errors when `semantic` is the default strategy:
1. A dish whose **title** contains the word (`"Salsa de yogur con marisco"`, menu 9) can outscore a dish whose **ingredients** contain specific members of that food group (`"gamba pelada"`, `"almejas"`, `"sepia"`, `"mejillones"` in menus 21, 29, 32, and 35), so a `sameDish` query like `"arroz con marisco"` returns menu 9 first (`0.961`, `similar`) instead of the four rice-with-seafood menus (`0.78–0.84`).
2. A dish that contains the exact ingredient or a member of the requested food group in `recipe_ingredient` can receive a rescaled semantic score below `1.0` (or below the `0.50` match threshold, as happens in `L10 "ternera"` where recipes list `"carne picada de ternera"` and `"solomillo de ternera"`, or in `C04 "salmón con verduras"` where `"Salmón al horno con espárragos verdes"` lists `"espárragos verdes"`).

Indexing the food groups of each recipe ingredient (`marisco`, `verduras`, `carne`, `ternera`, `legumbres`, etc.) at ingestion time with `gemini-3.8-flash` and combining the semantic score with the lexical + ingredient-group match via `Math.max(semantic, lexical)` for `literal` and grouped (`sameDish` / `anyOf`) constraints fixes both errors (`"arroz con marisco"` ranks menus 21, 29, 32, and 35 at `1.000` with `literal` evidence; `C04` rises from `0.3392` to `1.0000`, `L10` from `0.0000` to `0.8155`, and overall `semantic` nDCG@5 from `0.6726` to `0.6869`) while preserving the `0.8809` nDCG@5 of week-wide exclusions established in `MF-72`.

## What Changes

- **Database migration (`postgres/migrations/008-ingredient-groups.sql`)**: creates the `ingredient_group` table (`ingredient_name text PRIMARY KEY, food_groups text[] NOT NULL, model text NOT NULL`) with Row-Level Security enabled and no policies (`SEG-bd-acceso`). Storing one row per classified ingredient name (with `food_groups = '{}'` when the ingredient belongs to no canonical group) tracks which ingredients have already been classified by the model.
- **Ingredient classification port, Genkit adapter, and CLI command (`pnpm ingest ingredient-groups`)**:
  - Adds `IngredientClassifier` in `src/application/ports/ingredient-classifier.ts` and `GenkitIngredientClassifier` in `src/infrastructure/genkit/genkit-ingredient-classifier.ts` using `gemini-3.8-flash` (`DECOMPOSER_MODEL`, `thinkingLevel: 'LOW'`, `responseJsonSchema`, 60 s timeout, secret redaction) to classify distinct `recipe_ingredient.name` values into canonical food groups (`pollo`, `pavo`, `cerdo`, `ternera`, `conejo`, `carne`, `carne roja`, `pescado`, `pescado crudo`, `marisco`, `queso`, `huevo`, `legumbres`, `pasta`, `arroz`, `verduras`).
  - Extends `RecipeRepository` and `PostgresRecipeRepository` with `ingredientGroups()` and `saveIngredientGroups()` to read the distinct ingredient names from `recipe_ingredient` alongside their stored classification and upsert newly classified rows in one transaction.
  - Adds the `classifyIngredients` use case (`src/application/use-cases/ingest/classify-ingredients.ts`) and the `pnpm ingest ingredient-groups` CLI command (`src/cli/commands/ingredient-groups.ts`), idempotent like `pnpm ingest embed`: only unclassified ingredient names or rows from another model are sent to Gemini, and a second run with no changes makes zero LLM calls.
- **Ingredient-group lexical matching (`DishTextSearch` / `PostgresDishTextSearch`)**:
  - Extends `DishTextSearch.matches(term, options?: { includeIngredientGroups?: boolean })` so that non-week-wide-exclusion constraints match a dish when `phraseto_tsquery('spanish_unaccent', $1)` matches `menu_dish.name`, `recipe.title`, `recipe_ingredient.name`, **or** any element of `ingredient_group.food_groups` for an ingredient of the dish's recipe.
  - Week-wide exclusions (`isWeekWideExclusion`: ungrouped `exclude` constraints) pass `{ includeIngredientGroups: false }` so they continue matching only literal dish titles, recipe titles, and ingredient names (`BUS-superficie-consulta (b)`, `MF-72`).
- **Max-pooling of semantic and lexical scores (`findMenus`)**:
  - With the `semantic` strategy, for any constraint that has `type: 'literal'` or belongs to a `sameDish` or `anyOf` group, each dish's constraint score is `Math.max(semanticScore, lexicalScore)` (where `lexicalScore` includes `ingredient_group`), and its `literal` evidence flag reflects that lexical + ingredient-group match (`BUS-superficie-consulta (d)`).
  - Standalone `fuzzy` and `attribute` constraints keep `semanticScore` for ranking so broad terms like `"verduras"` in `C10 "huevos y verduras sin carne"` do not tie almost every menu at `1.0`.
- **Search evaluation report (`evals/search/results.md`)**: regenerated with `pnpm ingest evaluate-search` after indexing `ingredient_group`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `search-index`: adds migration `008-ingredient-groups.sql` (`ingredient_group` with RLS) and the idempotent CLI command `pnpm ingest ingredient-groups` that classifies distinct `recipe_ingredient.name` values into canonical food groups via `gemini-3.8-flash`.
- `menu-search`: modifies `Text match of a term`, `Semantic match of a term`, and `Evidence of a unit` so non-week-wide-exclusion constraints match `ingredient_group.food_groups`, and `literal` or grouped (`sameDish` / `anyOf`) constraints take `Math.max(semantic, lexical)` under the `semantic` strategy. The `Text match of a term` change also affects the `lexical` and `hybrid` strategies.

## Impact

- **Data touched & privacy (`SEG-datos-nutricionista`)**: reads distinct `recipe_ingredient.name` strings (generic culinary ingredient names such as `"gamba pelada"`, `"espárragos verdes"`, `"aceite de oliva"`) from Postgres and sends only uncached ingredient names to the Gemini API; nutritionist brand, email, slogan, and PDF filenames never enter `recipe_ingredient` or the prompt.
- **Abuse & failure surfaces (`context/safety-first.md`, `context/OWASP-Top10.md`)**:
  - **OWASP A03 (Injection) & `safety-first.md` §2.6**: `GenkitIngredientClassifier` requests structured JSON (`responseJsonSchema`) and `classifyIngredients` validates the model output with a strict Zod schema (`food_groups` restricted to the closed enum of 16 canonical groups, keys restricted to the requested ingredient names) before parameterized SQL insertion (`jsonb_to_recordset($1::jsonb)`). Invalid or partial model answers fail closed without writing to the database.
  - **OWASP A01 / A05 (`safety-first.md` §2.3, §2.4)**: `ingredient_group` enables Row-Level Security with no policy (`ALTER TABLE ingredient_group ENABLE ROW LEVEL SECURITY;`); only the CLI uses the owner connection (`DATABASE_URL_UNPOOLED`) and `GEMINI_API_KEY` to write to `ingredient_group`, while the web search stays read-only and makes zero new LLM calls per user query.
  - **Secret handling (`safety-first.md` §2.2, §3)**: any error from `GenkitIngredientClassifier` or `PostgresRecipeRepository` passes through `redactSecrets` / `describeDatabaseError` before being returned or printed by the CLI.
- **Dependencies**: none added (`@genkit-ai/google-genai`, `genkit`, `pg`, and `zod` are already installed).
