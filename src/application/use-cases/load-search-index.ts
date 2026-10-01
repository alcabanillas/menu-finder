import type { z } from "zod";
import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import type { Recipe } from "@/domain/recipe/recipe";
import { buildSearchDataset, embeddingDocument, embeddingSource } from "@/domain/search-index/search-dataset";
import { err, ok, type Result } from "@/shared/result";
import {
  recipesSchema,
  weeklyMenusSchema,
  type LoadSearchIndexError,
  type LoadSearchIndexSummary,
} from "../dto/load-search-index";
import type { DatasetFile, DatasetSource, DatasetSourceError } from "../ports/dataset-source";
import type { EmbeddingsPort } from "../ports/embeddings-port";
import type { SearchIndexWriter } from "../ports/search-index-writer";

/** The embedded text: recipe title and ingredient names (EVAL-golden-sets, ablation (b)). */
export const EMBEDDING_VARIANT = "name-ingredients";

export type LoadSearchIndexDeps = { dataset: DatasetSource; embeddings: EmbeddingsPort; index: SearchIndexWriter };

// Both files are lists, so a path starts with an index: `[1].ingredients`.
const formatPath = (path: PropertyKey[]): string =>
  path.length === 0
    ? "(root)"
    : path.map((part) => (typeof part === "number" ? `[${part}]` : `.${String(part)}`)).join("");

function parse<T>(
  read: Result<DatasetFile, DatasetSourceError>,
  schema: z.ZodType<T>,
): Result<T, LoadSearchIndexError> {
  if (!read.ok) return err({ kind: "source", error: read.error });
  const parsed = schema.safeParse(read.value.content);
  if (parsed.success) return ok(parsed.data);
  const [issue] = parsed.error.issues;
  return err({ kind: "invalid-shape", file: read.value.file, path: formatPath(issue.path), message: issue.message });
}

/**
 * `pnpm ingest load`: makes the search index equal to the local dataset. Both
 * files are validated before anything is read from or written to the index;
 * embeddings whose text and model did not change are kept, the others are
 * computed before the single write, so a failure leaves the index as it was.
 */
export async function loadSearchIndex({
  dataset,
  embeddings,
  index,
}: LoadSearchIndexDeps): Promise<Result<LoadSearchIndexSummary, LoadSearchIndexError>> {
  const menus = parse<WeeklyMenu[]>(await dataset.readMenus(), weeklyMenusSchema);
  if (!menus.ok) return menus;
  const recipes = parse<Recipe[]>(await dataset.readRecipes(), recipesSchema);
  if (!recipes.ok) return recipes;

  const built = buildSearchDataset(menus.value, recipes.value);
  if (!built.ok) return err({ kind: "unknown-recipe-files", dishes: built.error });
  const content = built.value;

  const stored = await index.embeddingSources(EMBEDDING_VARIANT);
  if (!stored.ok) return stored;
  const current = new Map(
    stored.value.filter((s) => s.model === embeddings.model).map((s) => [s.recipeKey, s.source]),
  );

  const documents = content.recipes.map((recipe) => ({ recipe, document: embeddingDocument(recipe) }));
  const keep = documents.filter(({ recipe, document }) => current.get(recipe.key) === embeddingSource(document));
  const missing = documents.filter((entry) => !keep.includes(entry));

  const add = [];
  if (missing.length > 0) {
    const computed = await embeddings.embedDocuments(missing.map(({ document }) => document));
    if (!computed.ok) return computed;
    const { model, dimensions, vectors } = computed.value;
    if (vectors.length !== missing.length) {
      return err({
        kind: "embedding-failed",
        reason: `the service returned ${vectors.length} vectors for ${missing.length} texts`,
      });
    }
    add.push(
      ...missing.map(({ recipe, document }, i) => ({
        recipeKey: recipe.key,
        model,
        source: embeddingSource(document),
        dimensions,
        vector: vectors[i],
      })),
    );
  }

  const written = await index.replace({
    dataset: content,
    embeddings: { variant: EMBEDDING_VARIANT, keep: keep.map(({ recipe }) => recipe.key), add },
  });
  if (!written.ok) return written;

  const meals = content.menus.flatMap((menu) => menu.meals);
  const nameOnlyRecipes = content.recipes.filter((recipe) => recipe.file === null).length;
  return ok({
    menus: content.menus.length,
    meals: meals.length,
    dishes: meals.reduce((total, meal) => total + meal.dishes.length, 0),
    recipes: content.recipes.length - nameOnlyRecipes,
    nameOnlyRecipes,
    embedded: add.length,
    kept: keep.length,
    model: embeddings.model,
  });
}
