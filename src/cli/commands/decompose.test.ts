import { describe, expect, it } from 'vitest';
import type { DecomposeError } from '@/application/dto/decomposition';
import type { SearchRequestDto } from '@/application/dto/search-request';
import { runDecompose } from '@/cli/commands/decompose';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const STRUCTURE: SearchRequestDto = {
  constraints: [
    { id: 'c1', type: 'attribute', term: 'rápidas', polarity: 'include', hard: false, slot: 'dinner' },
    { id: 'c2', type: 'exclusion', term: 'cerdo', polarity: 'exclude', hard: false },
  ],
  sameDish: [],
  anyOf: [],
};

const run = async (request: string, outcome: Result<SearchRequestDto, DecomposeError | MissingVariables>) => {
  const lines: string[] = [];
  const requests: string[] = [];
  const exitCode = await runDecompose({
    request,
    decomposeRequest: async (text) => {
      requests.push(text);
      return outcome;
    },
    print: (line) => lines.push(line),
  });
  return { exitCode, output: lines.join('\n'), requests };
};

describe('runDecompose', () => {
  it('prints the structure as JSON and exits with 0', async () => {
    const { exitCode, output, requests } = await run('cenas rápidas sin cerdo', ok(STRUCTURE));

    expect(exitCode).toBe(0);
    expect(requests).toEqual(['cenas rápidas sin cerdo']);
    expect(JSON.parse(output)).toEqual(STRUCTURE);
  });

  it('prints the rejection with its category and exits with 3', async () => {
    const { exitCode, output } = await run('asdfgh', err({ kind: 'rejected', category: 'gibberish' }));

    expect(exitCode).toBe(3);
    expect(output).toContain('gibberish');
  });

  it('says the request is too long and exits with 1', async () => {
    const { exitCode, output } = await run('a'.repeat(301), err({ kind: 'request-too-long', max: 300 }));

    expect(exitCode).toBe(1);
    expect(output).toContain('longer than 300 characters');
  });

  it('says the request is empty and exits with 1', async () => {
    const { exitCode, output } = await run('   ', err({ kind: 'request-too-short' }));

    expect(exitCode).toBe(1);
    expect(output).toContain('empty');
  });

  it('prints each problem of an invalid answer and exits with 1', async () => {
    const { exitCode, output } = await run(
      'algo con bacalao',
      err({
        kind: 'invalid-answer',
        issues: [
          { constraint: 'c1', field: 'term', message: 'the term is not in the request' },
          { field: 'sql', message: 'Unrecognized key' },
        ],
      }),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain('c1.term: the term is not in the request');
    expect(output).toContain('sql: Unrecognized key');
  });

  it('names the missing variable and exits with 1', async () => {
    const { exitCode, output } = await run('algo con bacalao', err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }));

    expect(exitCode).toBe(1);
    expect(output).toContain('GEMINI_API_KEY');
  });

  it('prints the failure of the model with its secrets redacted and exits with 1', async () => {
    const { exitCode, output } = await run(
      'algo con bacalao',
      err({ kind: 'decomposer-failed', reason: 'cannot reach postgres://owner:s3cret@db.example.test/menus' }),
    );

    expect(exitCode).toBe(1);
    expect(output).toContain('The decomposer failed');
    expect(output).not.toContain('s3cret');
  });
});
