import { join } from "node:path";
import type {
  DishQaRow,
  IngestMenusError,
  IngestMenusSummary,
  MenuFailure,
} from "@/application/dto/ingest-menus";
import type { Result } from "@/shared/result";
import { describeSourceError } from "@/cli/describe-source-error";
import { isInside } from "@/cli/qa-path";
import { isMissingVariables, missingLines } from "@/cli/commands/missing-variables";
import type { MissingVariables } from "@/composition/cli-container";

export type IngestMenuDeps = {
  ingestMenus: () => Promise<Result<IngestMenusSummary, IngestMenusError | MissingVariables>>;
  print: (line: string) => void;
  writeFile: (path: string, content: string) => Promise<void>;
  dataDir: string;
  qaDir: string;
};

const QA_CSV_FILE = "menu-platos-pdftable.csv";
const QA_MD_FILE = "qa-menu-platos-pdftable.md";

const CSV_HEADER = [
  "menu",
  "bloque",
  "dia",
  "plato",
  "tiene_receta_marcada",
  "match_receta",
  "score_match",
  "discarded_candidate",
  "discarded_score",
];

const formatScore = (score: number | null): string => (score === null ? "" : score.toFixed(2));

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

const toCsvLine = (row: DishQaRow): string =>
  [
    row.menu,
    row.type,
    row.day,
    row.dish,
    row.hasRecipeMark ? "1" : "0",
    row.matchedRecipe ?? "",
    formatScore(row.score),
    row.discardedCandidate ?? "",
    formatScore(row.discardedScore),
  ]
    .map(csvCell)
    .join(",");

const describeUnresolved = (row: DishQaRow): string => {
  const candidate =
    row.discardedCandidate === null
      ? "no candidate"
      : `discarded: ${row.discardedCandidate}, ${formatScore(row.discardedScore)}`;
  return `menu ${row.menu}, ${row.day}, ${row.type}, "${row.dish}" (${candidate})`;
};

const describeFailure = ({ menu, error }: MenuFailure): string => `Menu ${menu} error: ${describeSourceError(error)}`;

const summaryLines = ({ failures, totals, unresolved }: IngestMenusSummary): string[] => [
  `Menus processed without error: ${totals.menusProcessed}/${totals.menusFound}`,
  ...failures.map(describeFailure),
  `Empty slots: ${totals.emptySlots}`,
  `Slots with two or more dishes: ${totals.multiDishSlots}`,
  `Resolved marked dishes: ${totals.resolved}`,
  `Unmarked dishes: ${totals.unmarked}`,
  `Unresolved marked dishes: ${totals.unresolved}`,
  `Unclaimed recipe files: ${totals.unclaimedRecipeFiles}`,
  ...(unresolved.length === 0
    ? ["No unresolved marked dishes."]
    : unresolved.map((row) => `Unresolved: ${describeUnresolved(row)}`)),
];

const toQaMarkdown = (summary: IngestMenusSummary): string =>
  [
    "# QA — menu ingestion",
    "",
    ...summaryLines(summary).map((line) => `- ${line}`),
    "",
    `Per-dish detail in \`${QA_CSV_FILE}\`.`,
    "",
  ].join("\n");

const errorLines = (error: IngestMenusError | MissingVariables): string[] => {
  if (isMissingVariables(error)) return missingLines(error);
  switch (error.kind) {
    case "source-unavailable":
      return [`Cannot read the menus: ${describeSourceError(error.error)}`];
    case "no-menu-parsed":
      return [...error.failures.map(describeFailure), "No menu could be parsed."];
    case "save-failed":
      return [`Cannot save the menus: ${error.error.reason}`];
  }
};

/** `ingest menu`: runs the ingestion, prints its summary and writes the QA report. Returns the exit code. */
export async function runIngestMenu({ ingestMenus, print, writeFile, dataDir, qaDir }: IngestMenuDeps): Promise<number> {
  const qaFiles = [QA_CSV_FILE, QA_MD_FILE].map((file) => join(qaDir, file));
  if (!qaFiles.every((file) => isInside(dataDir, file))) {
    print(`The QA directory must be inside ${dataDir}: ${qaDir}`);
    return 1;
  }

  const result = await ingestMenus();
  if (!result.ok) {
    errorLines(result.error).forEach(print);
    return 1;
  }

  const summary = result.value;
  summaryLines(summary).forEach(print);
  const [csvPath, mdPath] = qaFiles;
  await writeFile(csvPath, [CSV_HEADER.map(csvCell).join(","), ...summary.qaRows.map(toCsvLine)].join("\n"));
  await writeFile(mdPath, toQaMarkdown(summary));
  return summary.failures.length > 0 ? 1 : 0;
}
