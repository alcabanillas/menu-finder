# Design

## Context

See `proposal.md` — Why for the retrieval failure modes (`"arroz con marisco"`, `C04 "salmón con verduras"`, `L10 "ternera"`).

Current architecture and constraints:
- `recipe_ingredient` (`postgres/migrations/001-search-schema.sql`) stores the normalized ingredient rows of every recipe (`recipe_key`, `position`, `name`, `household_measure`, `quantity`, `unit`, `optional`), currently 267 distinct `name` values across the 36 menus.
- `PostgresDishTextSearch` (`src/infrastructure/postgres/postgres-dish-text-search.ts`) matches a term against `menu_dish.name`, `recipe.title`, and `recipe_ingredient.name` using `phraseto_tsquery('spanish_unaccent', $1)`.
- `findMenus` (`src/application/services/search/find-menus.ts`) already splits constraints into `weekWideExclusions` (`isWeekWideExclusion`: ungrouped `exclude` constraints, matched lexically per `MF-72`) and `otherConstraints` (scored with the selected strategy).
- `AGENTS.md` enforces reusing existing ports whenever one fits, naming by domain concept (`ingredient-classifier`, `classify-ingredients`, `ingredient-groups`), and `context/safety-first.md` §2.4 and §2.6 require Row-Level Security on every table and strict schema validation of any LLM output before SQL execution.

## Goals / Non-Goals

**Goals:**
- Persist the canonical food groups of each distinct `recipe_ingredient.name` in Postgres (`ingredient_group`) via an idempotent CLI ingestion command (`pnpm ingest ingredient-groups`).
- Match `ingredient_group.food_groups` in `PostgresDishTextSearch` for every constraint except week-wide exclusions (`BUS-superficie-consulta (c)`).
- Combine `Math.max(semantic, lexical)` under the `semantic` strategy for `literal` constraints and members of `sameDish` / `anyOf` groups (`BUS-superficie-consulta (d)`), while keeping `semantic` alone for ungrouped `fuzzy` and `attribute` constraints.

**Non-Goals:**
- Changing the decomposer prompt, schema, or golden set (`evals/decomposer/`).
- Changing how week-wide exclusions (`MF-72`) are matched or how `evals/retrieval/ingredient-groups.json` (used only by the golden-set generator script) is built.
- Calling any LLM during user search queries for ingredient classification (classification happens once at ingestion time in the CLI).

## Decisions

### D1. Database table `ingredient_group` (`postgres/migrations/008-ingredient-groups.sql`)

```sql
CREATE TABLE ingredient_group (
  ingredient_name text PRIMARY KEY,
  food_groups text[] NOT NULL,
  model text NOT NULL
);

ALTER TABLE ingredient_group ENABLE ROW LEVEL SECURITY;
```

- **Why `ingredient_name text PRIMARY KEY` with `food_groups text[]` instead of `(ingredient_name, group_name)` rows**: an ingredient that belongs to zero canonical food groups (such as `"sal"`, `"agua"`, `"aceite de oliva"`, `"cebolla"`, `"ajo"`, `"perejil"`, `"patata"`) still gets a row with `food_groups = '{}'`. That records that `model` has already classified the ingredient, so re-running `pnpm ingest ingredient-groups` sees 0 unclassified ingredients and makes **0 calls** to Gemini (matching the idempotency of `pnpm ingest embed` in `search-index`).
- **Why no foreign key to `recipe_ingredient(name)`**: `recipe_ingredient` has primary key `(recipe_key, position)` because the same ingredient name appears in many recipes. Keying `ingredient_group` by `ingredient_name` avoids duplicating group arrays across recipes and survives `DELETE` + `INSERT` on `recipe_ingredient` when `pnpm ingest recipes` re-runs.

### D2. Port reuse vs. new port (`AGENTS.md` mandatory port rule)

We checked all 19 existing ports in `src/application/ports/`:
1. **Database persistence (`RecipeRepository` reused)**:
   - `RecipeRepository` (`src/application/ports/recipe-repository.ts`) already owns `recipe` and `recipe_ingredient`. Adding a separate `IngredientGroupRepository` port for metadata of `recipe_ingredient` would duplicate the boundary.
   - We extend `RecipeRepository` with two methods:
     - `ingredientGroups(): Promise<Result<IngredientToClassify[], RepositoryReadError>>` — returns every distinct `name` present in `recipe_ingredient` (ordered by `name COLLATE "C"`), together with its stored `{ foodGroups: FoodGroup[]; model: string } | null` from `LEFT JOIN ingredient_group`.
     - `saveIngredientGroups(groups: NewIngredientGroup[]): Promise<Result<void, RepositoryError>>` — upserts the classified rows into `ingredient_group` in a single transaction via `jsonb_to_recordset($1::jsonb)`.
   - Callers that only need a subset of `RecipeRepository` use `Pick<RecipeRepository, ...>`: `IngestRecipesDeps` already uses `Pick<RecipeRepository, 'saveAll'>`, `GetMenuRecipeDeps` uses `Pick<RecipeRepository, 'findByFiles'>`, and `ClassifyIngredientsDeps` uses `Pick<RecipeRepository, 'ingredientGroups' | 'saveIngredientGroups'>`. Thus `JsonFileRecipeRepository` (`Pick<RecipeRepository, 'saveAll' | 'findByFiles'>`) and `FanOutRepository` remain untouched without dummy methods.
2. **LLM classification (`IngredientClassifier` created)**:
   - None of the 19 existing ports covers batch classification of culinary ingredient names: `EmbeddingsPort` only produces float vectors, and `RequestDecomposer` decomposes a single user search string into constraints.
   - We add `IngredientClassifier` in `src/application/ports/ingredient-classifier.ts`:
     ```ts
     export interface IngredientClassifier {
       readonly model: string;
       classify(ingredientNames: string[]): Promise<Result<unknown, IngredientClassifierError>>;
     }
     ```
   - Following `RequestDecomposer` (`MF-40.2` design D2), the adapter (`GenkitIngredientClassifier` in `src/infrastructure/genkit/genkit-ingredient-classifier.ts`) returns `Result<unknown, IngredientClassifierError>` and the use case (`classifyIngredients`) validates the response with Zod (`safety-first.md` §2.6).

### D3. Canonical food groups, prompt, and Zod validation (`classifyIngredients`)

The 16 canonical food groups are defined in `src/domain/recipe/food-group.ts`:
```ts
export const FOOD_GROUPS = [
  'pollo',
  'pavo',
  'cerdo',
  'ternera',
  'conejo',
  'carne',
  'carne roja',
  'pescado',
  'pescado crudo',
  'marisco',
  'queso',
  'huevo',
  'legumbres',
  'pasta',
  'arroz',
  'verduras',
] as const;
```

- **Prompt boundary (`ingredient-classifier-prompt.ts`)**: instructs `gemini-3.8-flash` (`thinkingLevel: 'LOW'`, `TIMEOUT_MS = 60_000`) to classify each input ingredient name into the applicable groups from `FOOD_GROUPS` as a main dish ingredient (explicitly excluding soffritto condiments like garlic, onion, parsley, ginger, bay leaf, starchy tubers like potato, and fruits from `"verduras"`, and including crustaceans, molluscs, and cephalopods in `"marisco"`). The ingredient names are passed as a JSON array inside `<ingredients>...</ingredients>` tags.
- **Response schema & validation**:
  - `responseJsonSchema` asks Gemini for `{ items: Array<{ name: string; groups: FoodGroup[] }> }` (an array of `{ name, groups }` objects rather than dynamic object keys, because Gemini's `responseJsonSchema` enforces fixed property schemas reliably on array items).
  - `classifyIngredients` validates the raw response with Zod (`z.strictObject({ items: z.array(z.strictObject({ name: z.string(), groups: z.array(z.enum(FOOD_GROUPS)) })) })`) and checks that the returned `name` set matches the exact set of requested `pending` ingredient names (no missing ingredient, no invented ingredient, deduplicated `groups`). If validation fails, it returns `err({ kind: 'invalid-classification', reason })` and writes nothing to Postgres.

### D4. Matching `ingredient_group` in `DishTextSearch` and `PostgresDishTextSearch`

- `DishTextSearch` (`src/application/ports/dish-text-search.ts`) gains an optional second parameter:
  ```ts
  export type DishTextMatchOptions = { includeIngredientGroups?: boolean };

  export interface DishTextSearch {
    matches(term: string, options?: DishTextMatchOptions): Promise<Result<DishAddress[], DishTextSearchError>>;
  }
  ```
- When `options?.includeIngredientGroups ?? true` is `true`, `PostgresDishTextSearch` passes `$2 = true` to:
  ```sql
  SELECT d.menu_number AS menu, d.day, d.type AS meal, d.position
  FROM menu_dish d
  JOIN recipe r ON r.key = d.recipe_key
  CROSS JOIN phraseto_tsquery('spanish_unaccent', $1) AS q
  WHERE numnode(q) > 0
    AND (to_tsvector('spanish_unaccent', d.name) @@ q
      OR to_tsvector('spanish_unaccent', r.title) @@ q
      OR EXISTS (SELECT 1 FROM recipe_ingredient i
                 LEFT JOIN ingredient_group g ON g.ingredient_name = i.name AND $2::boolean
                 WHERE i.recipe_key = r.key
                   AND (to_tsvector('spanish_unaccent', i.name) @@ q
                     OR EXISTS (SELECT 1 FROM unnest(g.food_groups) AS fg
                                WHERE to_tsvector('spanish_unaccent', fg) @@ q))))
  ORDER BY d.menu_number, d.day, d.type, d.position
  ```
- **Why `to_tsvector('spanish_unaccent', fg) @@ q` over a hardcoded synonym map in TypeScript**: PostgreSQL's `spanish_unaccent` configuration stems singular and plural Spanish words (`verdura` ↔ `verduras`, `marisco` ↔ `mariscos`, `carne` ↔ `carnes`, `legumbre` ↔ `legumbres`, `huevo` ↔ `huevos`, `queso` ↔ `quesos`, `pasta` ↔ `pastas`) and matches multi-word groups (`carne roja`, `pescado crudo`) as phrases, using the exact same full-text rules as `menu_dish.name`, `recipe.title`, and `recipe_ingredient.name`.
- **Why `$2 = false` for week-wide exclusions**: in `MF-72`, we proved that expanding week-wide exclusions with `ingredient_group` drops `E01 "sin verduras"` nDCG@5 from `1.000` to `0.000` because every menu has some vegetable in its recipes. Passing `{ includeIngredientGroups: false }` for `weekWideExclusions` preserves `exclusion` nDCG@5 at `0.8809`.

### D5. Combining `Math.max(semantic, lexical)` in `findMenus` (`BUS-superficie-consulta (d)`)

In `src/application/services/search/find-menus.ts`:
- `scoreTerms` already computes both `semantic` (`ScoresByTerm`) and `lexical` (`ScoresByTerm`, using `dishText.matches(term)` which defaults to `includeIngredientGroups: true`) when `strategy !== 'lexical'`.
- Under `strategy === 'semantic'`:
  - A constraint uses `Math.max(semanticScore, lexicalScore)` when `usesLexicalMax(constraint, groupedIds)` is true, where `usesLexicalMax` holds if `constraint.type === 'literal'` or `groupedIds.has(constraint.id)` (the constraint belongs to a `sameDish` or `anyOf` unit).
  - Otherwise (an ungrouped `fuzzy` or `attribute` constraint, or an ungrouped `exclusion` if any existed), the constraint keeps `semanticScore`.
- **Why ungrouped `fuzzy` and `attribute` constraints do not take `Math.max(semantic, lexical)`**: in `C10 "huevos y verduras sin carne"`, `"verduras"` is decomposed as an ungrouped `fuzzy` constraint. If `"verduras"` took `Math.max(semantic, lexical)`, 35 of the 36 menus would score `1.0` on `"verduras"`, erasing the semantic ranking differentiation between menus with vegetable-centric dishes and menus that merely have a side vegetable (`C10` would drop from `0.7834` to `0.6645`). Restricting `Math.max(semantic, lexical)` to `literal` and grouped (`sameDish` / `anyOf`) constraints raises `C04 "salmón con verduras"` (`sameDish`) from `0.3392` to `1.0000` and `L10 "ternera"` (`literal`) from `0.0000` to `0.8155` while keeping `C10` at `0.7834`.

## Risks / Trade-offs

- **[Risk] Batch classification latency for 267 ingredients** → Setting `TIMEOUT_MS = 60_000` in `GenkitIngredientClassifier` gives sufficient headroom for the single initial call (~10–20 s on `gemini-3.8-flash` with `thinkingLevel: 'LOW'`); subsequent runs are no-ops unless new recipes introduce unseen ingredient names.
- **[Risk] Model omits an ingredient or invents a food group name** → `classifyIngredients` validates the complete output with Zod against `FOOD_GROUPS` and checks exact set equality of ingredient names before opening any write transaction (`safety-first.md` §2.6).

## Migration Plan

1. Run `pnpm ingest migrate` against the database (`DATABASE_URL_UNPOOLED`) to apply `008-ingredient-groups.sql`.
2. Run `pnpm ingest ingredient-groups` to classify the 267 distinct ingredient names and populate `ingredient_group`.
3. Run `pnpm ingest evaluate-search` to update `evals/search/results.md`.
4. Before releasing to production, run `pnpm ingest migrate` and `pnpm ingest ingredient-groups` against the production Neon database (`context/despliegue.md`). Rollback is `DROP TABLE IF EXISTS ingredient_group;`.
