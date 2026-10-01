import type { LoadSearchIndexError, LoadSearchIndexSummary } from "@/application/dto/load-search-index";
import { isMissingVariables, missingLines } from "@/cli/commands/missing-variables";
import type { MissingVariables } from "@/composition/cli-container";
import { redactSecrets } from "@/shared/redact-secrets";
import type { Result } from "@/shared/result";

type Print = (line: string) => void;

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
    if (!isMissingVariables(result.error)) print("The database is unchanged.");
    return 1;
  }
  const { menus, meals, dishes, recipes, nameOnlyRecipes, embedded, kept, model } = result.value;
  print(`Loaded ${menus} menus, ${meals} meals, ${dishes} dishes, ${recipes} recipes and ${nameOnlyRecipes} name-only rows.`);
  print(`Embeddings with ${model}: ${embedded} computed, ${kept} kept.`);
  return 0;
}
