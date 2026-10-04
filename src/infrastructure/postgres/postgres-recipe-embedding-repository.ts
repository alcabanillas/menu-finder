import type pg from 'pg';
import type { DishAddress } from '@/application/ports/dish-text-search';
import type {
  DishSimilarity,
  EmbeddingStoreError,
  NewEmbedding,
  RecipeEmbeddingRepository,
  RecipeToEmbed,
} from '@/application/ports/recipe-embedding-repository';
import { err, ok, type Result } from '@/shared/result';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';
import { asJson, inTransaction } from '@/infrastructure/postgres/transaction';

// Byte order (`COLLATE "C"`), so the order does not depend on the database locale.
const SELECT_DOCUMENTS = `
  SELECT r.key AS "recipeKey", r.title,
         COALESCE((SELECT array_agg(i.name ORDER BY i.position) FROM recipe_ingredient i WHERE i.recipe_key = r.key),
                  '{}') AS "ingredientNames",
         e.model, e.source
  FROM recipe r
  LEFT JOIN recipe_embedding e ON e.recipe_key = r.key AND e.variant = $1
  ORDER BY r.key COLLATE "C"`;

const UPSERT_EMBEDDINGS = `
  INSERT INTO recipe_embedding (recipe_key, variant, model, dimensions, source, embedding)
  SELECT recipe_key, $2, model, dimensions, source, embedding::vector FROM jsonb_to_recordset($1::jsonb)
    AS r(recipe_key text, model text, dimensions int, source text, embedding text)
  ON CONFLICT (recipe_key, variant) DO UPDATE SET
    model = EXCLUDED.model, dimensions = EXCLUDED.dimensions, source = EXCLUDED.source, embedding = EXCLUDED.embedding`;

// Exact scan with the cosine distance of pgvector (`<=>`), so the result is exact and repeatable (MF-41 design D5).
const SELECT_SIMILARITIES = `
  SELECT d.menu_number AS menu, d.day, d.type AS meal, d.position, 1 - (e.embedding <=> $2::vector) AS similarity
  FROM menu_dish d
  JOIN recipe_embedding e ON e.recipe_key = d.recipe_key AND e.variant = $1
  ORDER BY d.menu_number, d.day, d.type, d.position`;

type SimilarityRow = DishAddress & { similarity: number };

type DocumentRow =Omit<RecipeToEmbed, 'stored'> & { model: string | null; source: string | null };

/** The recipe rows of Postgres and their `vector(3072)` embeddings. */
export class PostgresRecipeEmbeddingRepository implements RecipeEmbeddingRepository {
  constructor(private readonly pool: pg.Pool) {}

  async documents(variant: string): Promise<Result<RecipeToEmbed[], EmbeddingStoreError>> {
    try {
      const { rows } = await this.pool.query<DocumentRow>(SELECT_DOCUMENTS, [variant]);
      return ok(
        rows.map(({ recipeKey, title, ingredientNames, model, source }) => ({
          recipeKey,
          title,
          ingredientNames,
          stored: model !== null && source !== null ? { model, source } : null,
        })),
      );
    } catch (error) {
      return failure(error);
    }
  }

  async saveAll(variant: string, embeddings: NewEmbedding[]): Promise<Result<void, EmbeddingStoreError>> {
    const rows = embeddings.map(({ recipeKey, model, dimensions, source, vector }) => ({
      recipe_key: recipeKey,
      model,
      dimensions,
      source,
      embedding: `[${vector.join(',')}]`,
    }));
    try {
      await inTransaction(this.pool, (client) => client.query(UPSERT_EMBEDDINGS, [asJson(rows), variant]));
      return ok(undefined);
    } catch (error) {
      return failure(error);
    }
  }

  async similarities(variant: string, vector: number[]): Promise<Result<DishSimilarity[], EmbeddingStoreError>> {
    try {
      const { rows } = await this.pool.query<SimilarityRow>(SELECT_SIMILARITIES, [variant, `[${vector.join(',')}]`]);
      return ok(rows.map(({ similarity, ...dish }) => ({ dish, similarity })));
    } catch (error) {
      return failure(error);
    }
  }
}

function failure(error: unknown): Result<never, EmbeddingStoreError> {
  return err({ kind: 'store-failed', reason: describeDatabaseError(error) });
}
