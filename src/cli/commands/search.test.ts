import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import { runSearch } from '@/cli/commands/search';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const FILE = 'evals/pollo.json';
const URL_WITH_PASSWORD = 'postgresql://owner:s3cr3t@ep-x.neon.tech/neondb';

const STRUCTURE = {
  constraints: [{ id: 'c1', type: 'literal', term: 'pollo', polarity: 'include', hard: true }],
  sameDish: [],
  anyOf: [],
};

const RESULT: SearchResultDto = {
  strategy: 'lexical',
  menus: [
    {
      menu: 3,
      score: 1,
      evidence: [
        { constraints: ['c1'], dish: { day: 'monday', meal: 'lunch', position: 1, name: 'Pollo asado' } },
        { constraints: ['c2'], dish: null },
      ],
    },
    { menu: 7, score: 0.5, evidence: [{ constraints: ['c1'], dish: null }] },
  ],
  tiedWithFirst: 1,
  removedBy: [
    { constraints: ['c1'], menusRemoved: 31 },
    { constraints: ['c3', 'c4'], menusRemoved: 2 },
  ],
};

type Outcome = Result<SearchResultDto, SearchMenusError | MissingVariables>;

async function search(content: string | null, outcome: Outcome = ok(RESULT), strategy: SearchStrategy = 'lexical') {
  const lines: string[] = [];
  const calls: { dto: SearchRequestDto; strategy: SearchStrategy }[] = [];
  const code = await runSearch({
    file: FILE,
    strategy,
    readFile: async () => {
      if (content === null) throw new Error(`ENOENT: no such file or directory, open '${FILE}'`);
      return content;
    },
    searchMenus: async (dto, chosen) => {
      calls.push({ dto, strategy: chosen });
      return outcome;
    },
    print: (line) => lines.push(line),
  });
  return { code, text: lines.join('\n'), calls };
}

describe('runSearch', () => {
  it('prints the ranking with its evidence, the ties with the first menu and the menus each hard unit removes', async () => {
    const { code, text, calls } = await search(JSON.stringify(STRUCTURE));

    expect(code).toBe(0);
    expect(calls).toEqual([{ dto: STRUCTURE, strategy: 'lexical' }]);
    expect(text).toBe(
      [
        'Search with the lexical strategy: 2 menus.',
        '1. Menu 3, score 1.000',
        '   c1: Pollo asado (monday lunch)',
        '   c2: no dish',
        '2. Menu 7, score 0.500',
        '   c1: no dish',
        'Menus tied with the first: 1',
        'Hard constraint c1 removes 31 menus.',
        'Hard constraint c3+c4 removes 2 menus.',
      ].join('\n'),
    );
  });

  it('says so when no menu is left and there is no hard constraint', async () => {
    const { code, text } = await search(JSON.stringify(STRUCTURE), ok({ ...RESULT, menus: [], tiedWithFirst: 0, removedBy: [] }));

    expect(code).toBe(0);
    expect(text).toContain('No menu is ranked.');
    expect(text).toContain('No hard constraint.');
  });

  it('searches a golden-set request without its id, text and origin, and passes every other key on', async () => {
    const golden = { id: 'A01', text: 'comidas con pollo', origin: 'retrieval-golden-set', ...STRUCTURE, hrad: true };

    const { calls } = await search(JSON.stringify(golden));

    expect(calls[0].dto).toEqual({ ...STRUCTURE, hrad: true });
  });

  it('exits 1 naming the file when it does not exist', async () => {
    const { code, text, calls } = await search(null);

    expect(code).toBe(1);
    expect(text).toContain(`Cannot read ${FILE}`);
    expect(calls).toEqual([]);
  });

  it('exits 1 naming the file when it is not JSON', async () => {
    const { code, text, calls } = await search('{not json');

    expect(code).toBe(1);
    expect(text).toContain(`${FILE} is not JSON`);
    expect(calls).toEqual([]);
  });

  it('exits 1 naming the file, the constraint and the field of an invalid structure', async () => {
    const invalid = err({
      kind: 'invalid-request' as const,
      issues: [
        { constraint: 'c1', field: 'term', message: 'Too small' },
        { field: 'hrad', message: 'Unrecognized key' },
      ],
    });

    const { code, text } = await search(JSON.stringify(STRUCTURE), invalid);

    expect(code).toBe(1);
    expect(text).toBe(`${FILE} is not a valid search structure:\n  c1.term: Too small\n  hrad: Unrecognized key`);
  });

  it('exits 1 naming the missing variable, never its value', async () => {
    const { code, text } = await search(JSON.stringify(STRUCTURE), err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }));

    expect(code).toBe(1);
    expect(text).toContain('GEMINI_API_KEY');
  });

  it('exits 1 and says to run embed when no embedding is stored', async () => {
    const outcome = err({ kind: 'index-not-loaded' as const, message: 'run `pnpm ingest embed` first' });

    const { code, text } = await search(JSON.stringify(STRUCTURE), outcome);

    expect(code).toBe(1);
    expect(text).toBe('run `pnpm ingest embed` first');
  });

  it('exits 1 and prints a failure without the credentials', async () => {
    const outcome = err({ kind: 'search-failed' as const, reason: `connect failed: ${URL_WITH_PASSWORD}` });

    const { code, text } = await search(JSON.stringify(STRUCTURE), outcome);

    expect(code).toBe(1);
    expect(text).toContain('The search failed: connect failed:');
    expect(text).not.toContain('s3cr3t');
  });
});
