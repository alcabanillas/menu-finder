import type { ClassifyIngredientsError, ClassifyIngredientsSummary } from '@/application/dto/classify-ingredients';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';
import { redactSecrets } from '@/shared/redact-secrets';
import type { Result } from '@/shared/result';

type Print = (line: string) => void;

const UNCHANGED_MESSAGE = 'The stored ingredient groups are unchanged.';

/** `ingest ingredient-groups`: classifies recipe ingredients into food groups. Returns the exit code. */
export async function runIngredientGroups({
  classifyIngredients,
  print,
}: {
  classifyIngredients: () => Promise<Result<ClassifyIngredientsSummary, ClassifyIngredientsError | MissingVariables>>;
  print: Print;
}): Promise<number> {
  const result = await classifyIngredients();
  if (!result.ok) {
    errorLines(result.error).forEach((line) => print(redactSecrets(line)));
    return 1;
  }
  const { ingredients, classified, kept, model } = result.value;
  if (ingredients === 0) {
    print('The database has no recipes: run `pnpm ingest recipes` first.');
    return 1;
  }
  print(`Ingredient groups with ${model} for ${ingredients} ingredients: ${classified} classified, ${kept} kept.`);
  return 0;
}

function errorLines(error: ClassifyIngredientsError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  if (error.kind === 'recipes-empty') {
    return ['The database has no recipes: run `pnpm ingest recipes` first.'];
  }
  if (error.kind === 'classifier-failed') {
    return [
      `The classification service failed: ${error.reason}`,
      UNCHANGED_MESSAGE,
    ];
  }
  if (error.kind === 'invalid-classification') {
    return [
      `The classification was invalid: ${error.reason}`,
      UNCHANGED_MESSAGE,
    ];
  }
  return [`The database failed: ${error.reason}`, UNCHANGED_MESSAGE];
}
