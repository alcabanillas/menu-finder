import type { EmbedRecipesError, EmbedRecipesSummary } from "@/application/dto/embed-recipes";
import type { EmbeddingsPort } from "@/application/ports/embeddings-port";
import type { RecipeEmbeddingRepository } from "@/application/ports/recipe-embedding-repository";
import { embeddingDocument, embeddingSource } from "@/domain/search/embedding-text";
import { err, ok, type Result } from "@/shared/result";

/** The embedded text: recipe title and ingredient names (EVAL-golden-sets, ablation (b)). */
export const EMBEDDING_VARIANT = "name-ingredients";

export type EmbedRecipesDeps = { store: RecipeEmbeddingRepository; embeddings: EmbeddingsPort };

/**
 * `pnpm ingest embed`: one embedding per recipe row. Only the rows with no
 * embedding, or whose text or model changed, go to the service, and every
 * vector is computed before the single write, so a failure stores nothing.
 */
export async function embedRecipes({
  store,
  embeddings,
}: EmbedRecipesDeps): Promise<Result<EmbedRecipesSummary, EmbedRecipesError>> {
  const rows = await store.documents(EMBEDDING_VARIANT);
  if (!rows.ok) return rows;

  const pending = rows.value
    .map(({ recipeKey, title, ingredientNames, stored }) => {
      const document = embeddingDocument(title, ingredientNames);
      return { recipeKey, document, source: embeddingSource(document), stored };
    })
    .filter(({ source, stored }) => stored?.model !== embeddings.model || stored.source !== source);

  const summary = {
    recipes: rows.value.length,
    embedded: pending.length,
    kept: rows.value.length - pending.length,
    model: embeddings.model,
  };
  if (pending.length === 0) return ok(summary);

  const computed = await embeddings.embedDocuments(pending.map(({ document }) => document));
  if (!computed.ok) return computed;
  const { model, dimensions, vectors } = computed.value;
  if (vectors.length !== pending.length) {
    return err({
      kind: "embedding-failed",
      reason: `the service returned ${vectors.length} vectors for ${pending.length} texts`,
    });
  }

  const saved = await store.saveAll(
    EMBEDDING_VARIANT,
    pending.map(({ recipeKey, source }, i) => ({ recipeKey, model, dimensions, source, vector: vectors[i] })),
  );
  return saved.ok ? ok(summary) : saved;
}
