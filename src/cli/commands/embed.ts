import type { EmbedRecipesError, EmbedRecipesSummary } from "@/application/dto/embed-recipes";
import { isMissingVariables, missingLines } from "@/cli/commands/missing-variables";
import type { MissingVariables } from "@/composition/cli-container";
import { redactSecrets } from "@/shared/redact-secrets";
import type { Result } from "@/shared/result";

type Print = (line: string) => void;

const errorLines = (error: EmbedRecipesError | MissingVariables): string[] => {
  if (isMissingVariables(error)) return missingLines(error);
  return error.kind === "embedding-failed"
    ? [`The embedding service failed: ${error.reason}`, "The stored embeddings are unchanged."]
    : [`The database failed: ${error.reason}`, "The stored embeddings are unchanged."];
};

/** `ingest embed`: computes the missing or outdated recipe embeddings. Returns the exit code. */
export async function runEmbed({
  embedRecipes,
  print,
}: {
  embedRecipes: () => Promise<Result<EmbedRecipesSummary, EmbedRecipesError | MissingVariables>>;
  print: Print;
}): Promise<number> {
  const result = await embedRecipes();
  if (!result.ok) {
    errorLines(result.error).forEach((line) => print(redactSecrets(line)));
    return 1;
  }
  const { recipes, embedded, kept, model } = result.value;
  if (recipes === 0) {
    print("The database has no recipes: run `pnpm ingest recipes` and `pnpm ingest menu` first.");
    return 1;
  }
  print(`Embeddings with ${model} for ${recipes} recipe rows: ${embedded} computed, ${kept} kept.`);
  return 0;
}
