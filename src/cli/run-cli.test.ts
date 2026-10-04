import { describe, expect, it } from 'vitest';
import type { CliCommands, SearchOptions } from '@/cli/run-cli';
import { runCli } from '@/cli/run-cli';

const setup = () => {
  const lines: string[] = [];
  let built = 0;
  let menuRuns = 0;
  let recipesRuns = 0;
  let migrateRuns = 0;
  let embedRuns = 0;
  const searches: SearchOptions[] = [];
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
      embed: async () => {
        embedRuns += 1;
        return 1;
      },
      search: async (options) => {
        searches.push(options);
        return 0;
      },
    };
  };
  return {
    lines,
    searches,
    run: (args: string[]) => runCli(args, { createCommands, print: (line) => lines.push(line) }),
    counts: () => ({ built, menuRuns, recipesRuns, migrateRuns, embedRuns, searchRuns: searches.length }),
  };
};

describe('runCli', () => {
  it('runs the menu command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['menu'])).toBe(0);
    expect(counts()).toEqual({ built: 1, menuRuns: 1, recipesRuns: 0, migrateRuns: 0, embedRuns: 0, searchRuns: 0 });
  });

  it('runs the recipes command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['recipes'])).toBe(1);
    expect(counts()).toEqual({ built: 1, menuRuns: 0, recipesRuns: 1, migrateRuns: 0, embedRuns: 0, searchRuns: 0 });
  });

  it('runs the migrate command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['migrate'])).toBe(0);
    expect(counts()).toEqual({ built: 1, menuRuns: 0, recipesRuns: 0, migrateRuns: 1, embedRuns: 0, searchRuns: 0 });
  });

  it('runs the embed command and returns its exit code', async () => {
    const { run, counts } = setup();

    expect(await run(['embed'])).toBe(1);
    expect(counts()).toEqual({ built: 1, menuRuns: 0, recipesRuns: 0, migrateRuns: 0, embedRuns: 1, searchRuns: 0 });
  });

  it('runs the search command with the hybrid strategy by default', async () => {
    const { run, searches } = setup();

    expect(await run(['search', 'pollo.json'])).toBe(0);
    expect(searches).toEqual([{ file: 'pollo.json', strategy: 'hybrid' }]);
  });

  it.each(['lexical', 'semantic', 'hybrid'])('runs the search command with --strategy %s', async (strategy) => {
    const { run, searches } = setup();

    expect(await run(['search', 'pollo.json', '--strategy', strategy])).toBe(0);
    expect(searches).toEqual([{ file: 'pollo.json', strategy }]);
  });

  it.each([
    [[]],
    [['foo']],
    [['menu', 'extra']],
    [['recipes', 'extra']],
    [['migrate', 'extra']],
    [['embed', '--force']],
    [['search']],
    [['search', 'a.json', 'b.json']],
    [['search', 'a.json', '--strategy']],
    [['search', 'a.json', '--strategy', 'fuzzy-magic']],
    [['search', 'a.json', '--strategy', 'lexical', 'extra']],
    [['search', '--strategy', 'lexical']],
  ])('prints the usage and exits with 2 without building the commands for %j', async (args) => {
    const { run, counts, lines } = setup();

    expect(await run(args)).toBe(2);
    expect(lines.join('\n')).toContain('Usage: pnpm ingest <migrate|recipes|menu|embed|search>');
    expect(counts()).toEqual({ built: 0, menuRuns: 0, recipesRuns: 0, migrateRuns: 0, embedRuns: 0, searchRuns: 0 });
  });

  it('lists every command in the usage', async () => {
    const { run, lines } = setup();

    await run(['foo']);

    for (const command of ['menu', 'recipes', 'migrate', 'embed', 'search']) {
      expect(lines.some((line) => line.trim().startsWith(`${command} `))).toBe(true);
    }
  });
});
