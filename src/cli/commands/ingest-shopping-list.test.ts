import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { IngestShoppingListsError, IngestShoppingListsSummary } from '@/application/dto/ingest-shopping-lists';
import { err, ok, type Result } from '@/shared/result';
import { runIngestShoppingList } from '@/cli/commands/ingest-shopping-list';
import type { MissingVariables } from '@/composition/cli-container';

const DATA_DIR = join('repo', 'data');
const QA_DIR = join(DATA_DIR, 'qa');
const QA_FILE = join(QA_DIR, 'qa-lista-compra.md');

const SUMMARY: IngestShoppingListsSummary = {
  perMenu: [
    { menu: 1, pages: 1, items: 30 },
    { menu: 4, pages: 2, items: 60 },
  ],
  failures: [],
  anomalies: [
    {
      menu: 4,
      anomaly: { kind: 'unrecognized-line', text: 'unrecognized line text' },
    },
  ],
  totals: {
    listsRead: 2,
    listsWithMultiplePages: 1,
    items: 90,
    optionalItems: 5,
    itemsWithoutQuantity: 8,
  },
};

const WITH_FAILURE: IngestShoppingListsSummary = {
  ...SUMMARY,
  failures: [
    { menu: 3, error: { kind: 'missing-file', file: 'Lista_de_la_compra.pdf' } },
  ],
};

const setup = (
  result: Result<IngestShoppingListsSummary, IngestShoppingListsError | MissingVariables>,
  qaDir = QA_DIR,
) => {
  const lines: string[] = [];
  const files = new Map<string, string>();
  const ingestShoppingLists = vi.fn(async () => result);
  const run = () =>
    runIngestShoppingList({
      ingestShoppingLists,
      print: (line) => lines.push(line),
      writeFile: async (path, content) => {
        files.set(path, content);
      },
      dataDir: DATA_DIR,
      qaDir,
    });
  return { run, lines, files, ingestShoppingLists };
};

describe('runIngestShoppingList', () => {
  it('Pages in the report: shows 4 with 2 pages and 1 with 1, and 1 list with more than one page', async () => {
    const { run, lines, files } = setup(ok(SUMMARY));

    expect(await run()).toBe(0);

    expect(lines).toContain('Menu 4: 2 pages, 60 items');
    expect(lines).toContain('Menu 1: 1 page, 30 items');
    expect(lines).toContain('Lists with more than one page: 1');

    const report = files.get(QA_FILE) ?? '';
    expect(report).toContain('- Lists with more than one page: 1');
    expect(report).toContain('| 4 | 2 | 60 |');
    expect(report).toContain('| 1 | 1 | 30 |');
  });

  it('QA directory outside data: prints error, runs nothing, exits 1', async () => {
    const { run, files, ingestShoppingLists } = setup(
      ok(SUMMARY),
      join(DATA_DIR, '..', 'elsewhere'),
    );

    expect(await run()).toBe(1);
    expect(ingestShoppingLists).not.toHaveBeenCalled();
    expect(files.size).toBe(0);
  });

  it('Exit code with failures: exits 1, lists failure in console and QA report, saves others', async () => {
    const { run, lines, files } = setup(ok(WITH_FAILURE));

    expect(await run()).toBe(1);
    expect(lines).toContain('Menu 3 error: Lista_de_la_compra.pdf not found');

    const report = files.get(QA_FILE) ?? '';
    expect(report).toContain('- Menu 3 error: Lista_de_la_compra.pdf not found');
  });

  it('Missing database variables: prints missing variables and exits 1', async () => {
    const { run, lines, files } = setup(
      err({ kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] }),
    );

    expect(await run()).toBe(1);
    expect(lines).toContain(
      'Missing environment variable: DATABASE_URL_UNPOOLED. Set them in .env.local.',
    );
    expect(files.size).toBe(0);
  });

  it.each<[IngestShoppingListsError, string]>([
    [
      { kind: 'source-unavailable', error: { kind: 'missing-raw-directory', path: 'raw' } },
      'Cannot read the shopping lists: raw directory not found: raw',
    ],
    [
      { kind: 'no-list-parsed', failures: WITH_FAILURE.failures },
      'No shopping list could be parsed.',
    ],
    [
      { kind: 'save-failed', error: { kind: 'write-failed', reason: 'connection refused' } },
      'Cannot save the shopping lists: connection refused',
    ],
  ])('exits 1 on use-case error (%o) and writes nothing', async (error, message) => {
    const { run, lines, files } = setup(err(error));

    expect(await run()).toBe(1);
    expect(lines).toContain(message);
    expect(files.size).toBe(0);
  });

  it('prints each anomaly with its menu in console and QA report', async () => {
    const { run, lines, files } = setup(
      ok({
        ...SUMMARY,
        anomalies: [
          { menu: 2, anomaly: { kind: 'line-before-first-category', text: 'garbage' } },
          { menu: 3, anomaly: { kind: 'item-without-readable-amount', text: 'item text' } },
          { menu: 4, anomaly: { kind: 'unrecognized-line', text: 'extra text' } },
        ],
      }),
    );

    await run();

    expect(lines).toContain('Menu 2 anomaly: line before first category "garbage"');
    expect(lines).toContain('Menu 3 anomaly: item without readable amount "item text"');
    expect(lines).toContain('Menu 4 anomaly: unrecognized line "extra text"');

    const report = files.get(QA_FILE) ?? '';
    expect(report).toContain('- Menu 2 anomaly: line before first category "garbage"');
    expect(report).toContain('- Menu 3 anomaly: item without readable amount "item text"');
    expect(report).toContain('- Menu 4 anomaly: unrecognized line "extra text"');
  });

  it('describes empty shopping list failure', async () => {
    const { run, lines } = setup(
      ok({
        ...SUMMARY,
        failures: [{ menu: 5, error: { kind: 'empty-list' } }],
      }),
    );

    expect(await run()).toBe(1);
    expect(lines).toContain('Menu 5 error: empty shopping list');
  });

  it('formats singular item and None when there are no issues', async () => {
    const { run, lines, files } = setup(
      ok({
        perMenu: [{ menu: 1, pages: 1, items: 1 }],
        failures: [],
        anomalies: [],
        totals: {
          listsRead: 1,
          listsWithMultiplePages: 0,
          items: 1,
          optionalItems: 0,
          itemsWithoutQuantity: 0,
        },
      }),
    );

    expect(await run()).toBe(0);
    expect(lines).toContain('Menu 1: 1 page, 1 item');
    const report = files.get(QA_FILE) ?? '';
    expect(report).toContain('## Errors and anomalies\n\nNone.');
  });
});
