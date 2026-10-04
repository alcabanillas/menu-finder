import { join } from 'node:path';
import type {
  IngestShoppingListsError,
  IngestShoppingListsSummary,
  ShoppingListAnomaly,
  ShoppingListAnomalyRow,
  ShoppingListFailure,
} from '@/application/dto/ingest-shopping-lists';
import type { Result } from '@/shared/result';
import { describeSourceError } from '@/cli/describe-source-error';
import { isInside } from '@/cli/qa-path';
import { isMissingVariables, missingLines } from '@/cli/commands/missing-variables';
import type { MissingVariables } from '@/composition/cli-container';

export type IngestShoppingListDeps = {
  ingestShoppingLists: () => Promise<Result<IngestShoppingListsSummary, IngestShoppingListsError | MissingVariables>>;
  print: (line: string) => void;
  writeFile: (path: string, content: string) => Promise<void>;
  dataDir: string;
  qaDir: string;
};

const QA_FILE = 'qa-lista-compra.md';

/** `ingest shopping-list`: runs the ingestion, prints its summary and writes the QA report. Returns exit code. */
export async function runIngestShoppingList({
  ingestShoppingLists,
  print,
  writeFile,
  dataDir,
  qaDir,
}: IngestShoppingListDeps): Promise<number> {
  const qaFile = join(qaDir, QA_FILE);
  if (!isInside(dataDir, qaFile)) {
    print(`The QA directory must be inside ${dataDir}: ${qaDir}`);
    return 1;
  }

  const result = await ingestShoppingLists();
  if (!result.ok) {
    errorLines(result.error).forEach(print);
    return 1;
  }

  const summary = result.value;
  consoleLines(summary).forEach(print);
  await writeFile(qaFile, toQaMarkdown(summary));
  return summary.failures.length > 0 ? 1 : 0;
}

function errorLines(error: IngestShoppingListsError | MissingVariables): string[] {
  if (isMissingVariables(error)) return missingLines(error);
  switch (error.kind) {
    case 'source-unavailable':
      return [`Cannot read the shopping lists: ${describeSourceError(error.error)}`];
    case 'no-list-parsed':
      return [...error.failures.map(describeFailure), 'No shopping list could be parsed.'];
    case 'save-failed':
      return [`Cannot save the shopping lists: ${error.error.reason}`];
  }
}

function consoleLines(summary: IngestShoppingListsSummary): string[] {
  return [
    ...totalLines(summary),
    ...summary.perMenu.map(describeMenuCount),
    ...issueLines(summary),
  ];
}

function describeMenuCount({ menu, pages, items }: { menu: number; pages: number; items: number }): string {
  const pageWord = pages === 1 ? 'page' : 'pages';
  const itemWord = items === 1 ? 'item' : 'items';
  return `Menu ${menu}: ${pages} ${pageWord}, ${items} ${itemWord}`;
}

function totalLines({ totals }: IngestShoppingListsSummary): string[] {
  return [
    `Shopping lists read: ${totals.listsRead}`,
    `Lists with more than one page: ${totals.listsWithMultiplePages}`,
    `Items: ${totals.items}`,
    `Optional items: ${totals.optionalItems}`,
    `Items without quantity: ${totals.itemsWithoutQuantity}`,
  ];
}

function issueLines(summary: IngestShoppingListsSummary): string[] {
  return [
    ...summary.failures.map(describeFailure),
    ...summary.anomalies.map(describeAnomalyRow),
  ];
}

function describeFailure({ menu, error }: ShoppingListFailure): string {
  if (error.kind === 'empty-list') {
    return `Menu ${menu} error: empty shopping list`;
  }
  return `Menu ${menu} error: ${describeSourceError(error)}`;
}

function describeAnomalyRow({ menu, anomaly }: ShoppingListAnomalyRow): string {
  return `Menu ${menu} anomaly: ${describeAnomaly(anomaly)}`;
}

function describeAnomaly(anomaly: ShoppingListAnomaly): string {
  switch (anomaly.kind) {
    case 'line-before-first-category':
      return `line before first category "${anomaly.text}"`;
    case 'item-without-readable-amount':
      return `item without readable amount "${anomaly.text}"`;
    case 'unrecognized-line':
      return `unrecognized line "${anomaly.text}"`;
  }
}

function toQaMarkdown(summary: IngestShoppingListsSummary): string {
  const issues = issueLines(summary);
  return [
    '# QA — shopping list ingestion',
    '',
    ...totalLines(summary).map((line) => `- ${line}`),
    '',
    '| Menu | Pages | Items |',
    '|---|---|---|',
    ...summary.perMenu.map(({ menu, pages, items }) => `| ${menu} | ${pages} | ${items} |`),
    '',
    '## Errors and anomalies',
    '',
    ...(issues.length === 0 ? ['None.'] : issues.map((line) => `- ${line}`)),
    '',
  ].join('\n');
}
