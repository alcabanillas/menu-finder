export type EmbedRecipesSummary = {
  /** Recipe rows in the database, the rows of dishes without recipe file included. */
  recipes: number;
  /** Sent to the embedding service in this run. */
  embedded: number;
  /** Kept because their text and model did not change. */
  kept: number;
  model: string;
};

/** The embedding service or the vector store failed. The same kinds as their ports report (MF-59.4). */
export type EmbedRecipesError = { kind: 'embedding-failed'; reason: string } | { kind: 'store-failed'; reason: string };
