/** The text of a recipe row that is embedded: its title and ingredient names, never the preparation. */
export type EmbeddingDocument = { title: string; content: string };

/** Ingredient names joined by commas; a recipe row with no ingredients (a name-only dish) embeds its title instead. */
export function embeddingDocument(title: string, ingredientNames: string[]): EmbeddingDocument {
  return { title, content: ingredientNames.length > 0 ? ingredientNames.join(', ') : title };
}

/** What an embedding was computed from: the same source means the embedding can be kept. */
export const embeddingSource = ({ title, content }: EmbeddingDocument): string => `${title}\n${content}`;
