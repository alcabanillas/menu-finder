import type { SearchDataset } from "@/domain/search-index/search-dataset";
import type { Result } from "@/shared/result";

/** What a stored embedding was computed from. */
export type EmbeddingSource = { recipeKey: string; model: string; source: string };

export type NewEmbedding = EmbeddingSource & { dimensions: number; vector: number[] };

export type IndexContent = {
  dataset: SearchDataset;
  embeddings: {
    variant: string;
    /** Recipe keys whose stored embedding of this variant stays as it is. */
    keep: string[];
    add: NewEmbedding[];
  };
};

export type IndexError = { kind: "index-failed"; reason: string };

/** Write side of the search index. Search and evaluation never get it. */
export interface SearchIndexWriter {
  embeddingSources(variant: string): Promise<Result<EmbeddingSource[], IndexError>>;
  /**
   * Makes the index equal to `content` in one transaction: rows not in it are
   * removed, and so is every embedding of the variant not kept or added.
   */
  replace(content: IndexContent): Promise<Result<void, IndexError>>;
}
