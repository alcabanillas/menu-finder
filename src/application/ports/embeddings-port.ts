import type { EmbeddingDocument } from "@/domain/search-index/recipe-rows";
import type { Result } from "@/shared/result";

export type { EmbeddingDocument };

/** One vector per document, in the same order. */
export type Embeddings = { model: string; dimensions: number; vectors: number[][] };

export type EmbeddingError = { kind: "embedding-failed"; reason: string };

export interface EmbeddingsPort {
  /** The model the vectors come from: a different model means every stored vector is recomputed. */
  readonly model: string;
  embedDocuments(documents: EmbeddingDocument[]): Promise<Result<Embeddings, EmbeddingError>>;
}
