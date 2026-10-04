import type { EmbeddingDocument } from '@/domain/search/embedding-text';
import type { Result } from '@/shared/result';

export type { EmbeddingDocument };

/** One vector per document, in the same order. */
export type Embeddings = { model: string; dimensions: number; vectors: number[][] };

export type EmbeddingError = { kind: 'embedding-failed'; reason: string };

export interface EmbeddingsPort {
  /** The model the vectors come from: a different model means every stored vector is recomputed. */
  readonly model: string;
  embedDocuments(documents: EmbeddingDocument[]): Promise<Result<Embeddings, EmbeddingError>>;
  /** One vector per search term, in the same order, embedded with the query task prefix of the model. */
  embedQueries(terms: string[]): Promise<Result<number[][], EmbeddingError>>;
}
