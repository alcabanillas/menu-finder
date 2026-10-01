import { join } from "node:path";
import type {
  IngestRecipesError,
  IngestRecipesSummary,
  RecipeAnomaly,
  RecipeAnomalyRow,
  RecipeFailure,
} from "@/application/dto/ingest-recipes";
import type { Result } from "@/shared/result";
import { describeSourceError } from "@/cli/describe-source-error";
import { isInside } from "@/cli/qa-path";
import { isMissingVariables, missingLines } from "@/cli/commands/missing-variables";
import type { MissingVariables } from "@/composition/cli-container";

export type IngestRecipesDeps = {
  ingestRecipes: () => Promise<Result<IngestRecipesSummary, IngestRecipesError | MissingVariables>>;
  print: (line: string) => void;
  writeFile: (path: string, content: string) => Promise<void>;
  dataDir: string;
  qaDir: string;
};

// The legacy script's file name, kept so local habits and links still work.
const QA_FILE = "qa-recetas-pdfjs.md";

/** `ingest recipes`: runs the ingestion, prints its summary and writes the QA report. Returns the exit code. */
export async function runIngestRecipes({
  ingestRecipes,
  print,
  writeFile,
  dataDir,
  qaDir,
}: IngestRecipesDeps): Promise<number> {
  const qaFile = join(qaDir, QA_FILE);
  if (!isInside(dataDir, qaFile)) {
    print(`The QA directory must be inside ${dataDir}: ${qaDir}`);
    return 1;
  }

  const result = await ingestRecipes();
  if (!result.ok) {
    errorLines(result.error).forEach(print);
    return 1;
  }

  const summary = result.value;
  consoleLines(summary).forEach(print);
  await writeFile(qaFile, toQaMarkdown(summary));
  return summary.failures.length > 0 ? 1 : 0;
}

function errorLines(error: IngestRecipesError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  switch (error.kind) {
    case "source-unavailable":
      return [`Cannot read the recipes: ${describeSourceError(error.error)}`];
    case "no-recipe-parsed":
      return [...error.failures.map(describeFailure), "No recipe could be parsed."];
    case "save-failed":
      return [`Cannot save the recipes: ${error.error.reason}`];
  }
}

function describeFailure({ menu, file, error }: RecipeFailure): string {
  return `Menu ${menu}/${file} error: ${describeSourceError(error)}`;
}

function consoleLines(summary: IngestRecipesSummary): string[] {
  return [
    ...totalLines(summary),
    ...summary.perMenu.map(({ menu, files, parsed }) => `Menu ${menu}: ${files} files, ${parsed} parsed`),
    ...issueLines(summary),
  ];
}

function totalLines({ totals }: IngestRecipesSummary): string[] {
  const byField = Object.entries(totals.divergentByField)
    .map(([field, count]) => `${field}: ${count}`)
    .join(", ");
  const byUnit = Object.entries(totals.ingredientsByUnit)
    .map(([unit, count]) => `${unit}: ${count}`)
    .join(", ");
  return [
    `Recipe files parsed without error: ${totals.filesParsed}/${totals.filesFound}`,
    `Distinct recipe files: ${totals.distinctFiles}`,
    `Files in two or more menus: ${totals.repeatedFiles}`,
    `Files with divergent versions: ${totals.divergentFiles} (${byField})`,
    `Recipes with total time: ${totals.withTotalTime}`,
    `Recipes with preparation: ${totals.withPreparation} (${totals.paragraphs} paragraphs)`,
    `Ingredients: ${totals.ingredients} (${totals.ingredientsWithQuantity} with quantity and unit, ${totals.optionalIngredients} optional)`,
    `Distinct ingredient names: ${totals.distinctIngredientNames}`,
    `Ingredients per unit: ${byUnit}`,
  ];
}

function issueLines(summary: IngestRecipesSummary): string[] {
  return [
    ...summary.failures.map(describeFailure),
    ...summary.anomalies.map(describeAnomalyRow),
  ];
}

function describeAnomalyRow({ menu, file, anomaly }: RecipeAnomalyRow): string {
  return `Menu ${menu}/${file} anomaly: ${describeAnomaly(anomaly)}`;
}

function describeAnomaly(anomaly: RecipeAnomaly): string {
  switch (anomaly.kind) {
    case "missing-times-section":
      return "no TIEMPOS section";
    case "missing-closing-line":
      return "no closing line";
    case "missing-preparation-section":
      return "no PREPARACIÓN section";
    case "unknown-time-label":
      return `unknown time label "${anomaly.text}"`;
    case "invalid-time":
      return `invalid time ${anomaly.label} "${anomaly.text}"`;
    case "text-before-first-ingredient":
      return `text before the first ingredient "${anomaly.text}"`;
    case "amount-without-ingredient":
      return `amount without ingredient "${anomaly.text}"`;
    case "name-without-colon":
      return `ingredient name without colon "${anomaly.text}"`;
    case "ingredient-without-amount":
      return `ingredient without amount "${anomaly.text}"`;
    case "unrecognized-amount":
      return `unrecognized amount "${anomaly.text}"`;
    case "unexpected-second-page-text":
      return `unexpected text on page 2 "${anomaly.text}"`;
    case "no-ingredients":
      return "no ingredients";
    case "empty-preparation":
      return "empty preparation";
    case "missing-total-time":
      return "no total time";
  }
}

function toQaMarkdown(summary: IngestRecipesSummary): string {
  return [
    "# QA — recipe ingestion",
    "",
    "Content figures are over the saved recipes: one per file, from the highest-numbered menu.",
    "",
    ...totalLines(summary).map((line) => `- ${line}`),
    "",
    "| Menu | files | parsed |",
    "|---|---|---|",
    ...summary.perMenu.map(({ menu, files, parsed }) => `| ${menu} | ${files} | ${parsed} |`),
    "",
    "## Divergent versions",
    "",
    "The kept version is the highest menu's; the others are not saved.",
    "",
    "| File | Kept menu | Differing menus | Differing fields |",
    "|---|---|---|---|",
    ...summary.divergent.map(
      ({ file, keptMenu, differingMenus, fields }) =>
        `| ${file} | ${keptMenu} | ${differingMenus.join(", ")} | ${fields.join(", ")} |`,
    ),
    "",
    "## Errors and anomalies",
    "",
    ...issueLines(summary).map((line) => `- ${line}`),
    "",
  ].join("\n");
}
