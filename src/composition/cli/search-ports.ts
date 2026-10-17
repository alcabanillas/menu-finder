import pg from 'pg';
import type { EmbeddingsPort } from '@/application/ports/embeddings-port';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';
import { err } from '@/shared/result';

/** For the lexical strategy, which never embeds: a port that fails if it were ever called. */
export const NO_EMBEDDINGS: EmbeddingsPort = {
  model: 'none',
  embedDocuments: async () => err({ kind: 'embedding-failed', reason: 'no embedding service for this command' }),
  embedQueries: async () => err({ kind: 'embedding-failed', reason: 'no embedding service for this command' }),
};

/** The search ports over one pool, shared by `search` and `evaluate-search`. */
export function searchPorts(pool: pg.Pool, embeddings: EmbeddingsPort) {
  return {
    menus: new PostgresMenuRepository(pool),
    dishText: new PostgresDishTextSearch(pool),
    recipeEmbeddings: new PostgresRecipeEmbeddingRepository(pool),
    embeddings,
  };
}
