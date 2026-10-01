import { fileURLToPath } from "node:url";
import { join } from "node:path";
import pg from "pg";
import { ingestMenus } from "@/application/use-cases/ingest-menus";
import { ingestRecipes } from "@/application/use-cases/ingest-recipes";
import { loadSearchIndex } from "@/application/use-cases/load-search-index";
import { migrate } from "@/application/use-cases/migrate";
import { createGenkitEmbeddings } from "@/infrastructure/genkit/genkit-embeddings";
import { JsonFileDatasetSource } from "@/infrastructure/json-file/json-file-dataset-source";
import { JsonFileMenuRepository } from "@/infrastructure/json-file/json-file-menu-repository";
import { JsonFileRecipeRepository } from "@/infrastructure/json-file/json-file-recipe-repository";
import { LocalDocumentSource } from "@/infrastructure/local-documents/local-document-source";
import { MIGRATIONS_DIR, PostgresMigrationRunner } from "@/infrastructure/postgres/postgres-migration-runner";
import { PostgresSearchIndexWriter } from "@/infrastructure/postgres/postgres-search-index-writer";
import { err, ok, type Result } from "@/shared/result";

/** Environment variables a command needs and that are not set. Checked before connecting to anything. */
export type MissingVariables = { kind: "missing-variables"; names: string[] };

/** Resolved from this file, not from `process.cwd()`, so the CLI reads and writes the same folders wherever it runs. */
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

// The direct connection: migrations and the load need transactions (MF-41 design D2).
const DATABASE_URL = "DATABASE_URL_UNPOOLED";
const GEMINI_API_KEY = "GEMINI_API_KEY";

type Env = Record<string, string | undefined>;

/** The CLI owns the owner role of the database (ADR-001 §2); the web gets a limited role later (MF-17, MF-20). */
async function withPool<T>(url: string, run: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    return await run(pool);
  } finally {
    await pool.end();
  }
}

export function createCliContainer(env: Env = {}) {
  const dataDir = join(REPO_ROOT, "data");
  const source = new LocalDocumentSource(join(dataDir, "raw", "Dieta"));
  const menus = new JsonFileMenuRepository(dataDir);
  const recipes = new JsonFileRecipeRepository(dataDir);

  // Every variable is checked before anything is read or any connection is opened.
  const required = (...names: string[]): Result<string[], MissingVariables> => {
    const missing = names.filter((name) => !env[name]);
    return missing.length > 0 ? err({ kind: "missing-variables", names: missing }) : ok(names.map((name) => env[name]!));
  };

  return {
    dataDir,
    qaDir: join(dataDir, "qa"),
    ingestMenus: () => ingestMenus({ source, menus }),
    ingestRecipes: () => ingestRecipes({ source, recipes }),
    migrate: async () => {
      const vars = required(DATABASE_URL);
      if (!vars.ok) return vars;
      const [url] = vars.value;
      return withPool(url, (pool) => migrate({ runner: new PostgresMigrationRunner(pool, MIGRATIONS_DIR) }));
    },
    loadSearchIndex: async () => {
      const vars = required(DATABASE_URL, GEMINI_API_KEY);
      if (!vars.ok) return vars;
      const [url, key] = vars.value;
      return withPool(url, (pool) =>
        loadSearchIndex({
          dataset: new JsonFileDatasetSource(dataDir),
          embeddings: createGenkitEmbeddings(key),
          index: new PostgresSearchIndexWriter(pool),
        }),
      );
    },
  };
}
