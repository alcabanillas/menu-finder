import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchByTextError, SearchResultDto, SearchStrategy, TextSearchDto } from '@/application/dto/search-result';
import { runSearchText } from '@/cli/commands/search-text';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const STRUCTURE: Required<SearchRequestDto> = {
  constraints: [
    { id: 'c1', type: 'attribute', term: 'rápidas', polarity: 'include', hard: false, slot: 'dinner' },
    { id: 'c2', type: 'exclusion', term: 'alitas', polarity: 'exclude', hard: false },
  ],
  sameDish: [],
  anyOf: [],
};

function ranking(strategy: SearchStrategy): SearchResultDto {
  return {
    strategy,
    menus: [{ menu: 7, score: 1, evidence: [{ constraints: ['c1'], dish: { day: 'monday', meal: 'dinner', position: 1, name: 'Crema de calabaza' } }] }],
    tiedWithFirst: 1,
    ranked: [{ menu: 7, score: 1 }],
    removedBy: [],
  };
}

const URL_WITH_PASSWORD = 'postgresql://owner:s3cr3t@ep-x.neon.tech/neondb';

type Outcome = Result<TextSearchDto, SearchByTextError | MissingVariables>;

const run = async (request: string, strategy: SearchStrategy, outcome: Outcome) => {
  const lines: string[] = [];
  const calls: { request: string; strategy: SearchStrategy }[] = [];
  const exitCode = await runSearchText({
    request,
    strategy,
    searchByText: async (text, chosen) => {
      calls.push({ request: text, strategy: chosen });
      return outcome;
    },
    print: (line) => lines.push(line),
  });
  return { exitCode, output: lines.join('\n'), lines, calls };
};

describe('runSearchText', () => {
  it('prints the structure as JSON, then the ranking, and exits with 0', async () => {
    const { exitCode, lines, calls } = await run(
      'cenas rápidas sin alitas',
      'hybrid',
      ok({ structure: STRUCTURE, result: ranking('hybrid') }),
    );

    expect(exitCode).toBe(0);
    expect(calls).toEqual([{ request: 'cenas rápidas sin alitas', strategy: 'hybrid' }]);
    expect(JSON.parse(lines[0])).toEqual(STRUCTURE);
    expect(lines.slice(1).join('\n')).toContain('1. Menu 7, score 1.000');
  });

  it('searches with the strategy it is given and the ranking names it', async () => {
    const { calls, output } = await run('algo con pollo', 'lexical', ok({ structure: STRUCTURE, result: ranking('lexical') }));

    expect(calls[0].strategy).toBe('lexical');
    expect(output).toContain('Search with the lexical strategy');
  });

  it('prints the rejection with its category, no ranking, and exits with 3', async () => {
    const { exitCode, output } = await run('asdfgh', 'hybrid', err({ kind: 'rejected', category: 'gibberish' }));

    expect(exitCode).toBe(3);
    expect(output).toContain('gibberish');
    expect(output).not.toContain('Search with');
  });

  it('prints that the request gives nothing to search, no ranking, and exits with 3', async () => {
    const { exitCode, output } = await run('platos para el finde', 'hybrid', err({ kind: 'nothing-to-search' }));

    expect(exitCode).toBe(3);
    expect(output).toContain('nothing to search');
    expect(output).not.toContain('Search with');
  });

  it('prints each problem of an invalid answer and exits with 1', async () => {
    const issues = [{ constraint: 'c1', field: 'term', message: 'the term is not in the request' }];
    const { exitCode, output } = await run('algo con pollo', 'hybrid', err({ kind: 'invalid-answer', issues }));

    expect(exitCode).toBe(1);
    expect(output).toContain('c1.term: the term is not in the request');
  });

  it('says the request is too long and exits with 1', async () => {
    const { exitCode, output } = await run('a'.repeat(301), 'hybrid', err({ kind: 'request-too-long', max: 300 }));

    expect(exitCode).toBe(1);
    expect(output).toContain('longer than 300 characters');
  });

  it('prints a search failure without the connection string and exits with 1', async () => {
    const reason = `connect ECONNREFUSED ${URL_WITH_PASSWORD}`;
    const { exitCode, output } = await run('algo con pollo', 'hybrid', err({ kind: 'search-failed', reason }));

    expect(exitCode).toBe(1);
    expect(output).toContain('The search failed');
    expect(output).not.toContain('s3cr3t');
  });

  it('says the embedding service failed, with its reason, and exits with 1', async () => {
    const { exitCode, output } = await run('algo con pollo', 'semantic', err({ kind: 'embedding-failed', reason: 'quota exceeded' }));

    expect(exitCode).toBe(1);
    expect(output).toContain('The embedding service failed: quota exceeded');
  });

  it('names the run of embed when the index is not loaded and exits with 1', async () => {
    const message = 'no recipe embeddings are stored: run `pnpm ingest embed` first';
    const { exitCode, output } = await run('algo con pollo', 'hybrid', err({ kind: 'index-not-loaded', message }));

    expect(exitCode).toBe(1);
    expect(output).toContain('pnpm ingest embed');
  });

  it('prints each field of a structure the search refuses and exits with 1', async () => {
    const issues = [{ field: 'constraints', message: 'Too small' }, { constraint: 'c1', field: 'term', message: 'too long' }];
    const { exitCode, output } = await run('algo con pollo', 'hybrid', err({ kind: 'invalid-request', issues }));

    expect(exitCode).toBe(1);
    expect(output).toContain('constraints: Too small');
    expect(output).toContain('c1.term: too long');
  });

  it('names a missing variable and exits with 1', async () => {
    const { exitCode, output } = await run('algo con pollo', 'hybrid', err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }));

    expect(exitCode).toBe(1);
    expect(output).toContain('GEMINI_API_KEY');
  });
});
