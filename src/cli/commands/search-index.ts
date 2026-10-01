import type { MissingVariables } from "@/application/dto/configuration";
import type { LoadSearchIndexError, LoadSearchIndexSummary } from "@/application/dto/load-search-index";
import type { MigrateError, MigrateSummary } from "@/application/use-cases/migrate";
import { redactSecrets } from "@/shared/redact-secrets";
import type { Result } from "@/shared/result";

export type { MissingVariables };

type Print = (line: string) => void;

const missingLines = ({ names }: MissingVariables): string[] => [
  `Missing environment variable${names.length > 1 ? "s" : ""}: ${names.join(", ")}. Set them in .env.local.`,
];

const loadErrorLines = (error: LoadSearchIndexError | MissingVariables): string[] => {
  switch (error.kind) {
    case "missing-variables":
      return missingLines(error);
    case "source":
      return error.error.kind === "missing-file"
        ? [`data/${error.error.file} not found: run \`${error.error.command}\` first.`]
        : [`data/${error.error.file} is not JSON: ${error.error.reason}`];
    case "invalid-shape":
      return [`data/${error.file} is not valid at ${error.path}: ${error.message}`];
    case "unknown-recipe-files":
      return error.dishes.map(({ menu, dish, file }) => `Menu ${menu}, dish "${dish}": unknown recipe file ${file}`);
    case "embedding-failed":
      return [`The embedding service failed: ${error.reason}`];
    case "index-failed":
      return [`The database failed: ${error.reason}`];
  }
};

/** `ingest load`: loads the dataset and its embeddings into the search index. Returns the exit code. */
export async function runLoad({
  loadSearchIndex,
  print,
}: {
  loadSearchIndex: () => Promise<Result<LoadSearchIndexSummary, LoadSearchIndexError | MissingVariables>>;
  print: Print;
}): Promise<number> {
  const result = await loadSearchIndex();
  if (!result.ok) {
    loadErrorLines(result.error).forEach((line) => print(redactSecrets(line)));
    if (result.error.kind !== "missing-variables") print("The database is unchanged.");
    return 1;
  }
  const { menus, meals, dishes, recipes, nameOnlyRecipes, embedded, kept, model } = result.value;
  print(`Loaded ${menus} menus, ${meals} meals, ${dishes} dishes, ${recipes} recipes and ${nameOnlyRecipes} name-only rows.`);
  print(`Embeddings with ${model}: ${embedded} computed, ${kept} kept.`);
  return 0;
}

/** `ingest migrate`: applies the pending SQL migrations. Returns the exit code. */
export async function runMigrate({
  migrate,
  print,
}: {
  migrate: () => Promise<Result<MigrateSummary, MigrateError | MissingVariables>>;
  print: Print;
}): Promise<number> {
  const result = await migrate();
  if (result.ok) {
    if (result.value.applied.length === 0) print("No pending migrations.");
    result.value.applied.forEach((id) => print(`Applied ${id}`));
    return 0;
  }
  const error = result.error;
  if (error.kind === "missing-variables") {
    missingLines(error).forEach(print);
    return 1;
  }
  error.applied.forEach((id) => print(`Applied ${id}`));
  print(
    redactSecrets(error.migration ? `${error.migration} failed: ${error.reason}` : `Cannot migrate: ${error.reason}`),
  );
  return 1;
}
