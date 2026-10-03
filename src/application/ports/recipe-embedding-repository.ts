import type { Result } from '@/shared/result';

/** A recipe row to embed, with what its stored vector of the variant was computed from, if it has one. */
export type RecipeToEmbed = {
  recipeKey: string;
  title: string;
  /** In the recipe's order; empty for the row of a dish without recipe file. */
  ingredientNames: string[];
  stored: { model: string; source: string } | null;
};

export type NewEmbedding = { recipeKey: string; model: string; dimensions: number; source: string; vector: number[] };

export type EmbeddingStoreError = { kind: 'store-failed'; reason: string };

/** The recipe rows of the database and their embeddings, one per variant (EVAL-golden-sets). */
export interface RecipeEmbeddingRepository {
  /** Every recipe row, the rows of dishes without recipe file included. */
  documents(variant: string): Promise<Result<RecipeToEmbed[], EmbeddingStoreError>>;
  /** Inserts or replaces the given embeddings, in one transaction. */
  saveAll(variant: string, embeddings: NewEmbedding[]): Promise<Result<void, EmbeddingStoreError>>;
}
