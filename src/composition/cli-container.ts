import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import { ingestMenus } from '@/application/use-cases/ingest-menus';
import { ingestRecipes } from '@/application/use-cases/ingest-recipes';
import { embedRecipes } from '@/application/use-cases/embed-recipes';
import { migrate } from '@/application/use-cases/migrate';
import { FanOutRepository } from '@/infrastructure/fan-out/fan-out-repository';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { JsonFileMenuRepository, MENU_DATASET_FILE } from '@/infrastructure/json-file/json-file-menu-repository';
import { JsonFileRecipeRepository, RECIPE_DATASET_FILE } from '@/infrastructure/json-file/json-file-recipe-repository';
import { LocalDocumentSource } from '@/infrastructure/local-documents/local-document-source';
import { MIGRATIONS_DIR, PostgresMigrationRunner } from '@/infrastructure/postgres/postgres-migration-runner';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';
import { PostgresRecipeRepository } from '@/infrastructure/postgres/postgres-recipe-repository';
import { err, type Result } from '@/shared/result';

/** Environment variables a command needs and that are not set. Checked before connecting to anything. */
export type MissingVariables = { kind: 'missing-variables'; names: string[] };

/** Resolved from this file, not from `process.cwd()`, so the CLI reads and writes the same folders wherever it runs. */
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// The direct connection: migrations and saves need transactions (MF-41 design D2).
const DATABASE_URL = 'DATABASE_URL_UNPOOLED';
const GEMINI_API_KEY = 'GEMINI_API_KEY';

type Env = Record<string, string | undefined>;

/** Wires each CLI command to its use case and adapters. Reads `env` only when a command runs. */
export function createCliContainer(env: Env = {}) {
  const dataDir = join(REPO_ROOT, 'data');
  const source = new LocalDocumentSource(join(dataDir, 'raw', 'Dieta'));

  // PDF → JSON file → database (MF-41 design D1): the use cases get one repository and do not know there are two.
  const menuRepository = (pool: pg.Pool) =>
    new FanOutRepository(new JsonFileMenuRepository(dataDir), new PostgresMenuRepository(pool), `data/${MENU_DATASET_FILE}`);
  const recipeRepository = (pool: pg.Pool) =>
    new FanOutRepository(
      new JsonFileRecipeRepository(dataDir),
      new PostgresRecipeRepository(pool),
      `data/${RECIPE_DATASET_FILE}`,
    );

  // Every variable is checked before anything is read or any connection is opened.
  const onDatabase = <T>(work: (pool: pg.Pool) => Promise<T>) =>
    requiring(env, [DATABASE_URL], ([url]) => withPool(url, work));

  return {
    dataDir,
    qaDir: join(dataDir, 'qa'),
    ingestMenus: () => onDatabase((pool) => ingestMenus({ source, menus: menuRepository(pool) })),
    ingestRecipes: () => onDatabase((pool) => ingestRecipes({ source, recipes: recipeRepository(pool) })),
    migrate: () => onDatabase((pool) => migrate({ runner: new PostgresMigrationRunner(pool, MIGRATIONS_DIR) })),
    embedRecipes: () =>
      requiring(env, [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          embedRecipes({ store: new PostgresRecipeEmbeddingRepository(pool), embeddings: createGenkitEmbeddings(apiKey) }),
        ),
      ),
  };
}

/** Runs `work` with the values of `names`, or names every unset or empty one and runs nothing. */
async function requiring<T>(
  env: Env,
  names: string[],
  work: (values: string[]) => Promise<T>,
): Promise<T | Result<never, MissingVariables>> {
  const missing = names.filter((name) => !env[name]);
  if (missing.length > 0) return err({ kind: 'missing-variables', names: missing });
  return work(names.map((name) => env[name]!));
}

/** The CLI owns the owner role of the database (ADR-001 §2); the web gets a limited role later (MF-17, MF-20). */
async function withPool<T>(url: string, work: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}
