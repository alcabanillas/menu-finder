import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import pg from 'pg';
import { createAccount } from '@/application/use-cases/create-account';
import { ingestMenus } from '@/application/use-cases/ingest-menus';
import { ingestRecipes } from '@/application/use-cases/ingest-recipes';
import { embedRecipes } from '@/application/use-cases/embed-recipes';
import { evaluateSearch } from '@/application/use-cases/evaluate-search';
import { migrate } from '@/application/use-cases/migrate';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchStrategy } from '@/application/dto/search-result';
import type { EmbeddingsPort } from '@/application/ports/embeddings-port';
import { searchMenus } from '@/application/use-cases/search-menus';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { createAccountCreator } from '@/infrastructure/auth/create-account';
import { FanOutRepository } from '@/infrastructure/fan-out/fan-out-repository';
import { FileGoldenSetSource } from '@/infrastructure/golden-sets/file-golden-set-source';
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
const BETTER_AUTH_SECRET = 'BETTER_AUTH_SECRET';

// The library asks for a base URL when it is built, but only uses it to write email-verification links, and this system
// verifies no email (SEG-sistema-cerrado). The session cookie is signed with the secret, not with the URL, so an account
// created here signs in on the deployed web. The CLI never serves a request, so this is a fixed value, not a variable.
const ACCOUNT_BASE_URL = 'http://localhost:3000';

/** What `ingest account` asks for. The password is read only after the environment is known to be complete. */
export type AccountRequest = { email: string; name?: string; readPassword: () => Promise<string> };

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

  // The search ports over one pool, shared by `search` and `evaluate-search`.
  const searchPorts = (pool: pg.Pool, embeddings: EmbeddingsPort) => ({
    menus: new PostgresMenuRepository(pool),
    dishText: new PostgresDishTextSearch(pool),
    recipeEmbeddings: new PostgresRecipeEmbeddingRepository(pool),
    embeddings,
  });

  return {
    dataDir,
    qaDir: join(dataDir, 'qa'),
    searchReportPath: join(REPO_ROOT, 'evals', 'search', 'results.md'),
    ingestMenus: () => onDatabase((pool) => ingestMenus({ source, menus: menuRepository(pool) })),
    ingestRecipes: () => onDatabase((pool) => ingestRecipes({ source, recipes: recipeRepository(pool) })),
    migrate: () => onDatabase((pool) => migrate({ runner: new PostgresMigrationRunner(pool, MIGRATIONS_DIR) })),
    createAccount: ({ email, name, readPassword }: AccountRequest) =>
      requiring(env, [DATABASE_URL, BETTER_AUTH_SECRET], async ([url, secret]) => {
        const password = await readPassword();
        return withPool(url, (pool) =>
          createAccount(
            { accounts: createAccountCreator({ pool, secret, baseUrl: ACCOUNT_BASE_URL }) },
            { email, name, password },
          ),
        );
      }),
    embedRecipes: () =>
      requiring(env, [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          embedRecipes({ store: new PostgresRecipeEmbeddingRepository(pool), embeddings: createGenkitEmbeddings(apiKey) }),
        ),
      ),
    // Always the direct URL; the key only for the strategies that embed the terms (spec menu-search, R6).
    searchMenus: (dto: SearchRequestDto, strategy: SearchStrategy) =>
      requiring(env, strategy === 'lexical' ? [DATABASE_URL] : [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          searchMenus(dto, strategy, searchPorts(pool, apiKey === undefined ? NO_EMBEDDINGS : createGenkitEmbeddings(apiKey))),
        ),
      ),
    // Read only: the three strategies, so the key is always needed (spec search-evaluation).
    evaluateSearch: () =>
      requiring(env, [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          evaluateSearch({
            goldenSets: new FileGoldenSetSource(join(REPO_ROOT, 'evals')),
            ...searchPorts(pool, createGenkitEmbeddings(apiKey)),
          }),
        ),
      ),
  };
}

/** For the lexical strategy, which never embeds: a port that fails if it were ever called. */
const NO_EMBEDDINGS: EmbeddingsPort = {
  model: 'none',
  embedDocuments: async () => err({ kind: 'embedding-failed', reason: 'no embedding service for this command' }),
  embedQueries: async () => err({ kind: 'embedding-failed', reason: 'no embedding service for this command' }),
};

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
