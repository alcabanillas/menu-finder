import type { EmbeddingError } from "@/application/ports/embeddings-port";
import type { EmbeddingStoreError } from "@/application/ports/recipe-embedding-repository";

export type EmbedRecipesSummary = {
  /** Recipe rows in the database, the rows of dishes without recipe file included. */
  recipes: number;
  /** Sent to the embedding service in this run. */
  embedded: number;
  /** Kept because their text and model did not change. */
  kept: number;
  model: string;
};

export type EmbedRecipesError = EmbeddingError | EmbeddingStoreError;
