import { describe, expect, it } from 'vitest';
import type { CliCommands, SearchOptions } from '@/cli/run-cli';
import { runCli } from '@/cli/run-cli';

const USAGE_HEADER = 'Usage: pnpm ingest <migrate|recipes|menu|shopping-list|embed|account|search|evaluate-search|decompose>';
const NO_RUNS = {
  built: 0,
  menuRuns: 0,
  recipesRuns: 0,
  migrateRuns: 0,
  shoppingListRuns: 0,
  embedRuns: 0,
  accountRuns: [],
  searches: [],
  evaluations: 0,
  decompositions: [],
};

const setup = () => {
  const lines: string[] = [];
  let built = 0;
  let menuRuns = 0;
  let recipesRuns = 0;
  let migrateRuns = 0;
  let shoppingListRuns = 0;
  let embedRuns = 0;
  const accountRuns: string[][] = [];
  const searches: SearchOptions[] = [];
  let evaluations = 0;
  const decompositions: string[][] = [];
  const createCommands = (): CliCommands => {
    built += 1;
    return {
      menu: async () => {
        menuRuns += 1;
        return 0;
      },
      recipes: async () => {
        recipesRuns += 1;
        return 1;
      },
      migrate: async () => {
        migrateRuns += 1;
        return 0;
      },
      'shopping-list': async () => {
        shoppingListRuns += 1;
        return 0;
      },
      embed: async () => {
        embedRuns += 1;
        return 1;
      },
      account: async (args) => {
        accountRuns.push(args);
        return 0;
      },
      search: async (options) => {
        searches.push(options);
        return 0;
      },
      'evaluate-search': async () => {
        evaluations += 1;
        return 0;
      },
      decompose: async (args) => {
        decompositions.push(args);
        return 3;
      },
    };
  };
  return {
    lines,
    run: (args: string[]) => runCli(args, { createCommands, print: (line) => lines.push(line) }),
    counts: () => ({
      built,
      menuRuns,
      recipesRuns,
      migrateRuns,
      shoppingListRuns,
      embedRuns,
      accountRuns,
      searches,
      evaluations,
      decompositions,
    }),
  };
};

describe('runCli', () => {
  it('runs the menu command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['menu'])).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, menuRuns: 1 });
  });

  it('runs the recipes command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['recipes'])).toBe(1);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, recipesRuns: 1 });
  });

  it('runs the migrate command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['migrate'])).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, migrateRuns: 1 });
  });

  it('runs the shopping-list command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['shopping-list'])).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, shoppingListRuns: 1 });
  });

  it('runs the embed command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['embed'])).toBe(1);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, embedRuns: 1 });
  });

  it.each([
    [['account', 'ana@example.test'], ['ana@example.test']],
    [['account', 'ana@example.test', 'Ana G.'], ['ana@example.test', 'Ana G.']],
  ])('runs the account command with its arguments for %j', async (args, expected) => {
    const { run, counts } = setup();

    expect(await run(args)).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, accountRuns: [expected] });
  });

  it('runs the decompose command with its request and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['decompose', 'cenas rápidas sin cerdo'])).toBe(3);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, decompositions: [['cenas rápidas sin cerdo']] });
  });

  it.each([[['decompose']], [['decompose', 'cenas rápidas', 'sin cerdo']]])(
    'prints the usage for decompose with %j and builds nothing',
    async (args) => {
      const { run, lines, counts } = setup();

      expect(await run(args)).toBe(2);
      expect(lines.join('\n')).toContain(USAGE_HEADER);
      expect(counts()).toEqual(NO_RUNS);
    },
  );

  it('runs the evaluate-search command', async () => {
    const { run, counts } = setup();

    expect(await run(['evaluate-search'])).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, evaluations: 1 });
  });

  it('runs the search command with the hybrid strategy by default', async () => {
    const { run, counts } = setup();

    expect(await run(['search', 'pollo.json'])).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, searches: [{ file: 'pollo.json', strategy: 'hybrid' }] });
  });

  it.each(['lexical', 'semantic', 'hybrid'])('runs the search command with --strategy %s', async (strategy) => {
    const { run, counts } = setup();

    expect(await run(['search', 'pollo.json', '--strategy', strategy])).toBe(0);
    expect(counts()).toEqual({ ...NO_RUNS, built: 1, searches: [{ file: 'pollo.json', strategy }] });
  });

  it.each([
    [[]],
    [['foo']],
    [['menu', 'extra']],
    [['recipes', 'extra']],
    [['migrate', 'extra']],
    [['shopping-list', 'extra']],
    [['embed', '--force']],
    [['account']],
    [['account', 'ana@example.test', 'Ana', 'a-long-enough-pass']],
    [['search']],
    [['search', 'a.json', 'b.json']],
    [['search', 'a.json', '--strategy']],
    [['search', 'a.json', '--strategy', 'fuzzy-magic']],
    [['search', 'a.json', '--strategy', 'lexical', 'extra']],
    [['search', '--strategy', 'lexical']],
    [['evaluate-search', '--strategy', 'lexical']],
  ])('prints the usage and exits with 2 without building the commands for %j', async (args) => {
    const { run, counts, lines } = setup();

    expect(await run(args)).toBe(2);
    expect(lines.join('\n')).toContain(USAGE_HEADER);
    expect(counts()).toEqual(NO_RUNS);
  });

  it('lists every command in the usage', async () => {
    const { run, lines } = setup();

    await run(['foo']);

    for (const usage of [
      'menu ',
      'recipes ',
      'migrate ',
      'shopping-list ',
      'embed ',
      'account <email> [name]',
      'search <structure.json>',
      'evaluate-search ',
      'decompose <request>',
    ]) {
      expect(lines.some((line) => line.trim().startsWith(usage))).toBe(true);
    }
  });

  it('lists the ingestion commands in the required order', async () => {
    const { run, lines } = setup();

    await run(['foo']);

    const fullText = lines.join('\n');
    const migratePos = fullText.indexOf('migrate');
    const recipesPos = fullText.indexOf('recipes');
    const menuPos = fullText.indexOf('menu');
    const shoppingPos = fullText.indexOf('shopping-list');
    const embedPos = fullText.indexOf('embed');

    expect(migratePos).toBeLessThan(recipesPos);
    expect(recipesPos).toBeLessThan(menuPos);
    expect(menuPos).toBeLessThan(shoppingPos);
    expect(shoppingPos).toBeLessThan(embedPos);
  });
});
