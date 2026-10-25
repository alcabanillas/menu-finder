# Tasks

## 1. Database migration `008-ingredient-groups.sql` (D1)

- [x] 1.1 Write failing test in `src/infrastructure/postgres/postgres-migration-runner.test.ts` (red): `available()` lists `008-ingredient-groups.sql` and applying `008-ingredient-groups.sql` creates `ingredient_group` (`ingredient_name`, `food_groups`, `model`) with primary key `ingredient_name` and row-level security enabled
- [x] 1.2 Create `postgres/migrations/008-ingredient-groups.sql` (`CREATE TABLE ingredient_group` + `ALTER TABLE ingredient_group ENABLE ROW LEVEL SECURITY;`) and verify `postgres-migration-runner.test.ts` passes

## 2. Ingredient classification port, use case, and adapters (D2, D3)

- [x] 2.1 Add `FOOD_GROUPS` and `FoodGroup` in `src/domain/recipe/food-group.ts`, `IngredientClassifier` and `ingredientClassificationSchema` in `src/application/ports/ingredient-classifier.ts`, `ClassifyIngredientsSummary` and `ClassifyIngredientsError` in `src/application/dto/classify-ingredients.ts`, and `ingredientGroups()` / `saveIngredientGroups()` on `RecipeRepository` (`src/application/ports/recipe-repository.ts`, narrowing `JsonFileRecipeRepository` to `Pick<RecipeRepository, 'saveAll' | 'findByFiles'>`); verify `pnpm typecheck` passes
- [x] 2.2 Write failing unit tests in `src/application/use-cases/ingest/classify-ingredients.test.ts` (red): classifies only ingredient names with no row or from another model; stores `[]` when an ingredient belongs to no group; makes no model call when every ingredient is already classified with the current model; returns `recipes-empty` when `ingredientGroups()` is empty; returns `invalid-classification` and writes nothing when the model omits an ingredient, adds an unknown ingredient, or returns a non-canonical group; propagates classifier and repository errors without writing
- [x] 2.3 Implement `classifyIngredients` in `src/application/use-cases/ingest/classify-ingredients.ts` and verify `classify-ingredients.test.ts` passes
- [x] 2.4 Write failing integration tests in `src/infrastructure/postgres/postgres-recipe-repository.test.ts` (red): `ingredientGroups()` returns distinct `recipe_ingredient.name` values ordered by byte order (`COLLATE "C"`) with their stored `foodGroups` and `model` (or `null` when unclassified); `saveIngredientGroups()` upserts rows (including empty `foodGroups = []`) in one transaction and returns `write-failed` without partial writes on database error
- [x] 2.5 Implement `ingredientGroups()` and `saveIngredientGroups()` in `src/infrastructure/postgres/postgres-recipe-repository.ts` and verify `postgres-recipe-repository.test.ts` passes
- [x] 2.6 Write failing unit tests in `src/infrastructure/genkit/genkit-ingredient-classifier.test.ts` (red): sends the prompt with `<ingredients>` and `responseJsonSchema`, parses JSON answer, fails on empty answer or timeout, and redacts the API key from error messages
- [x] 2.7 Implement `ingredientClassifierPrompt` in `src/infrastructure/genkit/ingredient-classifier-prompt.ts` and `GenkitIngredientClassifier` / `createGenkitIngredientClassifier` in `src/infrastructure/genkit/genkit-ingredient-classifier.ts`; verify `genkit-ingredient-classifier.test.ts` passes

## 3. CLI command `pnpm ingest ingredient-groups` (D2)

- [x] 3.1 Write failing CLI tests in `src/cli/commands/ingredient-groups.test.ts` and `src/cli/run-cli.test.ts` (red): `ingredient-groups` prints classified and kept counts and exits 0; exits 1 with message when `ingredients === 0`; exits 1 naming a missing `DATABASE_URL_UNPOOLED` or `GEMINI_API_KEY` without connecting; redacts secrets from classifier or database errors; rejects extra CLI arguments with exit code 2
- [x] 3.2 Implement `runIngredientGroups` in `src/cli/commands/ingredient-groups.ts`, wire `classifyIngredients` in `src/composition/cli/ingest.ts`, `src/cli/run-cli.ts`, and `src/cli/index.ts`, and verify `ingredient-groups.test.ts` and `run-cli.test.ts` pass

## 4. Ingredient-group matching in `PostgresDishTextSearch` (D4)

- [x] 4.1 Write failing integration tests in `src/infrastructure/postgres/postgres-dish-text-search.test.ts` (red): `matches('marisco')` (default `includeIngredientGroups: true`) matches a dish whose recipe ingredient (`gamba pelada`) has `'marisco'` in `ingredient_group.food_groups`, and `matches('verdura')` matches `'verduras'` via Spanish stemming; `matches('marisco', { includeIngredientGroups: false })` ignores `ingredient_group` and matches only literal dish name, recipe title, or ingredient name
- [x] 4.2 Update `DishTextSearch` (`src/application/ports/dish-text-search.ts`) and `PostgresDishTextSearch` (`src/infrastructure/postgres/postgres-dish-text-search.ts`) to accept `{ includeIngredientGroups?: boolean }` (default `true`) and match `ingredient_group.food_groups` with `to_tsvector('spanish_unaccent', fg) @@ q`; verify `postgres-dish-text-search.test.ts` passes

## 5. Max-pooling `Math.max(semantic, lexical)` in `findMenus` (D5)

- [x] 5.1 Write failing unit tests in `src/application/services/search/find-menus.test.ts` (red): with strategy `semantic`, a `literal` constraint or a constraint in `sameDish` / `anyOf` takes `Math.max(semantic, lexical)` as its term score (so a dish with semantic score `0.4` and lexical/group match `1` scores `1`), an ungrouped `fuzzy` or `attribute` constraint keeps its `semantic` score (`0.6` even when lexical is `1`, while its `literal` flag is `true`), and week-wide exclusions call `dishText.matches(term, { includeIngredientGroups: false })` while non-exclusion constraints call `dishText.matches(term)` (with ingredient groups enabled)
- [x] 5.2 Update `findMenus` in `src/application/services/search/find-menus.ts` to pass `{ includeIngredientGroups: false }` only for week-wide exclusions and compute `Math.max(semantic, lexical)` under `semantic` for `literal` and grouped (`sameDish` / `anyOf`) constraints; verify `find-menus.test.ts` passes

## 6. Run migration, classify ingredients, and regenerate search evaluation

- [x] 6.1 Run `pnpm ingest migrate` and `pnpm ingest ingredient-groups` against the database, then run `pnpm ingest ingredient-groups` a second time and verify it makes 0 LLM calls (`0 classified, 267 kept`)
- [x] 6.2 Run `pnpm ingest evaluate-search` to regenerate `evals/search/results.md`, and run `pnpm ingest search-text "arroz con marisco"` to verify menus 21, 29, 32, and 35 rank at `1.000` (`literal`)
- [x] 6.3 Update `context/runbooks/T0-extraccion-previa.md` with the `pnpm ingest ingredient-groups` step in the ingestion sequence
- [x] 6.4 Run `pnpm typecheck`, `pnpm exec eslint <touched files> --rule "import/no-cycle: off"`, and `pnpm test:coverage`; review `context/seguridad/safety-first.md` §4 and record the checklist results in this file. Result (2026-10-23): typecheck and ESLint on the touched files pass; `pnpm test:coverage` with `DATABASE_URL_TEST` passes 1868 tests in 182 files, none skipped (statements 98.4 %, branches 94.74 %). Checklist: all items pass or do not apply, no deviations

### Safety checklist (`context/seguridad/safety-first.md` §4)

- [x] ¿Toda decisión de negocio/seguridad crítica vive en el backend? Sí: clasificación, validación con Zod y matching léxico en Postgres.
- [x] ¿Cada endpoint nuevo valida auth, permisos y forma de los datos de entrada? Sí: la CLI valida variables requeridas (`DATABASE_URL_UNPOOLED`, `GEMINI_API_KEY`) y la respuesta del LLM se valida exhaustivamente con Zod.
- [x] ¿El usuario y sus permisos salen de la sesión, no de parámetros enviados por el cliente? N/A (no aplica a ingesta/búsqueda).
- [x] ¿Cada endpoint nuevo tiene sus tests negativos de autorización y corren en CI? Sí: tests de variables faltantes, secretos redactados, fallos de modelo y fallos de BD.
- [x] ¿Los datos devueltos son el mínimo necesario, no el modelo completo? Sí: `ClassifyIngredientsSummary` solo expone recuentos y modelo.
- [x] ¿Ningún secreto quedó hardcodeado o en el diff a commitear? Sí: claves por variables de entorno y redacción con `redactSecrets`.
- [x] ¿Cada dependencia nueva existe en npm...? N/A (no hay dependencias nuevas).
- [x] ¿Las queries a BD están parametrizadas (sin concatenación de strings)? Sí: consultas parametrizadas `$1`, `$2`, transacciones seguras y RLS activado en `ingredient_group`.
- [x] ¿Cada entrada nueva tiene tests con valores inesperados? Sí: Zod estricto, ingredientes inventados, omitidos o sustituidos probados en unit tests. Contra prompt injection, los nombres van saneados entre delimitadores `<ingredients>` (con su test) y la respuesta solo se acepta si nombra exactamente los ingredientes enviados.
- [x] ¿Una acción sensible introducida queda registrada en logs...? N/A.
- [x] Si algo se desvía de una regla DEBE de este documento, ¿está justificado y documentado? Sin desviaciones.
