import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';
import type { EmbeddingDocument, EmbeddingError, Embeddings, EmbeddingsPort } from '@/application/ports/embeddings-port';
import { redactSecrets } from '@/shared/redact-secrets';
import { err, ok, type Result } from '@/shared/result';

/** IA-proveedor (MF-41 design D5). */
export const EMBEDDING_MODEL = 'gemini-embedding-2';

// Texts per call to `embedMany`. For `gemini-embedding-2` the Genkit plugin sends one request per text,
// all at once (`Promise.all`): with 100 the API answered 503 in the first real load (MF-41 task 6.2).
const BATCH_SIZE = 10;

/** One vector per text, in order. Replaced in tests. */
export type EmbedMany = (texts: string[]) => Promise<number[][]>;

/** Embeds documents with Gemini through Genkit, `BATCH_SIZE` texts per call. Errors never carry the API key. */
export class GenkitEmbeddings implements EmbeddingsPort {
  readonly model = EMBEDDING_MODEL;

  constructor(
    private readonly embedMany: EmbedMany,
    private readonly apiKey: string,
    private readonly batchSize = BATCH_SIZE,
  ) {}

  async embedDocuments(documents: EmbeddingDocument[]): Promise<Result<Embeddings, EmbeddingError>> {
    const embedded = await this.embedTexts(documents.map(documentText));
    if (!embedded.ok) return embedded;
    const vectors = embedded.value;

    const dimensions = vectors[0]?.length ?? 0;
    const other = vectors.find((vector) => vector.length !== dimensions);
    if (other) {
      return err({ kind: 'embedding-failed', reason: `vectors of different sizes: ${dimensions} and ${other.length}` });
    }
    return ok({ model: this.model, dimensions, vectors });
  }

  async embedQueries(terms: string[]): Promise<Result<number[][], EmbeddingError>> {
    return this.embedTexts(terms.map(queryText));
  }

  private async embedTexts(texts: string[]): Promise<Result<number[][], EmbeddingError>> {
    const vectors: number[][] = [];
    try {
      for (let start = 0; start < texts.length; start += this.batchSize) {
        vectors.push(...(await this.embedMany(texts.slice(start, start + this.batchSize))));
      }
      return ok(vectors);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({ kind: 'embedding-failed', reason: redactSecrets(message, [this.apiKey]) });
    }
  }
}

/** The embedding service of the Gemini API through Genkit; the key is passed in, never read by the plugin. */
export function createGenkitEmbeddings(apiKey: string): GenkitEmbeddings {
  const ai = genkit({ plugins: [googleAI({ apiKey })] });
  const embedder = googleAI.embedder(EMBEDDING_MODEL);
  return new GenkitEmbeddings(
    async (texts) => (await ai.embedMany({ embedder, content: texts })).map((item) => item.embedding),
    apiKey,
  );
}

// `gemini-embedding-2` has no `task_type` for text: the task goes in the text (Gemini API docs, D5).
function documentText({ title, content }: EmbeddingDocument): string {
  return `title: ${title || 'none'} | text: ${content}`;
}

// A search term is a query: MF-41 design D5 fixes this prefix for `mf-42-menu-search`.
function queryText(term: string): string {
  return `task: search result | query: ${term}`;
}
