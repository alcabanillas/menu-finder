import { join } from 'node:path';
import type pg from 'pg';
import { embedRecipes } from '@/application/use-cases/ingest/embed-recipes';
import { ingestMenus } from '@/application/use-cases/ingest/ingest-menus';
import { ingestRecipes } from '@/application/use-cases/ingest/ingest-recipes';
import { ingestShoppingLists } from '@/application/use-cases/ingest/ingest-shopping-lists';
import { migrate } from '@/application/use-cases/ingest/migrate';
import { FanOutRepository } from '@/infrastructure/fan-out/fan-out-repository';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { JsonFileMenuRepository, MENU_DATASET_FILE } from '@/infrastructure/json-file/json-file-menu-repository';
import { JsonFileRecipeRepository, RECIPE_DATASET_FILE } from '@/infrastructure/json-file/json-file-recipe-repository';
import { LocalDocumentSource } from '@/infrastructure/local-documents/local-document-source';
import { MIGRATIONS_DIR, PostgresMigrationRunner } from '@/infrastructure/postgres/postgres-migration-runner';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import { PostgresShoppingListRepository } from '@/infrastructure/postgres/postgres-shopping-list-repository';
import { REPO_ROOT } from './repo-root';
import { DATABASE_URL, GEMINI_API_KEY, requiring, type Env } from './requiring';
import { withPool } from './with-pool';

/** Ingest commands wired to their sources and repositories. */
export function ingestCommands(env: Env) {
  const dataDir = join(REPO_ROOT, 'data');
  const source = new LocalDocumentSource(join(dataDir, 'raw', 'Dieta'));

  // Every variable is checked before anything is read or any connection is opened.
  const onDatabase = <T>(work: (pool: pg.Pool) => Promise<T>) =>
    requiring(env, [DATABASE_URL], ([url]) => withPool(url, work));

  return {
    dataDir,
    qaDir: join(dataDir, 'qa'),
    ingestMenus: () => onDatabase((pool) => ingestMenus({ source, menus: menuRepository(dataDir, pool) })),
    ingestRecipes: () => onDatabase((pool) => ingestRecipes({ source, recipes: recipeRepository(dataDir, pool) })),
    ingestShoppingLists: () =>
      onDatabase((pool) =>
        ingestShoppingLists({ source, shoppingLists: new PostgresShoppingListRepository(pool) }),
      ),
    migrate: () => onDatabase((pool) => migrate({ runner: new PostgresMigrationRunner(pool, MIGRATIONS_DIR) })),
    embedRecipes: () =>
      requiring(env, [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          embedRecipes({ store: new PostgresRecipeEmbeddingRepository(pool), embeddings: createGenkitEmbeddings(apiKey) }),
        ),
      ),
  };
}

// PDF → JSON file → database (MF-41 design D1): the use cases get one repository and do not know there are two.
function menuRepository(dataDir: string, pool: pg.Pool) {
  return new FanOutRepository(new JsonFileMenuRepository(dataDir), new PostgresMenuRepository(pool), `data/${MENU_DATASET_FILE}`);
}

function recipeRepository(dataDir: string, pool: pg.Pool) {
  return new FanOutRepository(
    new JsonFileRecipeRepository(dataDir),
    new PostgresRecipeRepository(pool),
    `data/${RECIPE_DATASET_FILE}`,
  );
}
