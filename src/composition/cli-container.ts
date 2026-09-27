import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { ingestMenus } from "@/application/use-cases/ingest-menus";
import { ingestRecipes } from "@/application/use-cases/ingest-recipes";
import { JsonFileMenuRepository } from "@/infrastructure/json-file/json-file-menu-repository";
import { JsonFileRecipeRepository } from "@/infrastructure/json-file/json-file-recipe-repository";
import { LocalDocumentSource } from "@/infrastructure/local-documents/local-document-source";

/** Resolved from this file, not from `process.cwd()`, so the CLI reads and writes the same folders wherever it runs. */
const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

export function createCliContainer() {
  const dataDir = join(REPO_ROOT, "data");
  const source = new LocalDocumentSource(join(dataDir, "raw", "Dieta"));
  const menus = new JsonFileMenuRepository(dataDir);
  const recipes = new JsonFileRecipeRepository(dataDir);

  return {
    dataDir,
    qaDir: join(dataDir, "qa"),
    ingestMenus: () => ingestMenus({ source, menus }),
    ingestRecipes: () => ingestRecipes({ source, recipes }),
  };
}
