import { describe, expect, it, vi } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import { createCliContainer } from '@/composition/cli-container';

// A host that does not exist: if the container tried to connect, the error would be a network error.
const UNREACHABLE = 'postgresql://user:password@unreachable.invalid/db';

const STRUCTURE: SearchRequestDto = {
  constraints: [{ id: 'c1', type: 'literal', term: 'pollo', polarity: 'include', hard: false }],
};

describe('createCliContainer', () => {
  it('names a missing key for embed and does not connect', async () => {
    const container = createCliContainer({ DATABASE_URL_UNPOOLED: UNREACHABLE });

    expect(await container.embedRecipes()).toEqual({
      ok: false,
      error: { kind: 'missing-variables', names: ['GEMINI_API_KEY'] },
    });
  });

  it('names every missing variable for embed', async () => {
    expect(await createCliContainer({}).embedRecipes()).toEqual({
      ok: false,
      error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED', 'GEMINI_API_KEY'] },
    });
  });

  it('names a missing connection string for migrate', async () => {
    expect(await createCliContainer({ GEMINI_API_KEY: 'key' }).migrate()).toEqual({
      ok: false,
      error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] },
    });
  });

  it.each(['ingestMenus', 'ingestRecipes'] as const)(
    'names a missing connection string for %s before reading any PDF',
    async (command) => {
      expect(await createCliContainer({})[command]()).toEqual({
        ok: false,
        error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] },
      });
    },
  );

  describe('createAccount', () => {
    const SECRET = 'x'.repeat(32);
    const request = (readPassword: () => Promise<string>) => ({ email: 'ana@example.test', readPassword });

    it('names every missing variable and does not ask for the password', async () => {
      const readPassword = vi.fn(async () => 'a-long-enough-pass');

      expect(await createCliContainer({}).createAccount(request(readPassword))).toEqual({
        ok: false,
        error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED', 'BETTER_AUTH_SECRET'] },
      });
      expect(readPassword).not.toHaveBeenCalled();
    });

    it('names a missing secret', async () => {
      const container = createCliContainer({ DATABASE_URL_UNPOOLED: UNREACHABLE });

      expect(await container.createAccount(request(async () => 'a-long-enough-pass'))).toEqual({
        ok: false,
        error: { kind: 'missing-variables', names: ['BETTER_AUTH_SECRET'] },
      });
    });

    it('asks for a password when it is empty, without connecting', async () => {
      const container = createCliContainer({ DATABASE_URL_UNPOOLED: UNREACHABLE, BETTER_AUTH_SECRET: SECRET });

      expect(await container.createAccount(request(async () => ''))).toEqual({
        ok: false,
        error: { kind: 'password-required' },
      });
    });
  });

  it('treats an empty variable as missing', async () => {
    expect(await createCliContainer({ DATABASE_URL_UNPOOLED: '' }).migrate()).toEqual({
      ok: false,
      error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] },
    });
  });

  // The variables are checked before any connection is opened, so these tests need no database.
  describe('evaluateSearch', () => {
    it('names every missing variable and reads nothing', async () => {
      expect(await createCliContainer({}).evaluateSearch()).toEqual({
        ok: false,
        error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED', 'GEMINI_API_KEY'] },
      });
    });

    it('writes the report to evals/search/results.md of the repository', () => {
      expect(createCliContainer({}).searchReportPath.replaceAll('\\', '/')).toMatch(/\/evals\/search\/results\.md$/);
    });
  });

  describe('searchMenus', () => {
    it('asks only for the direct database URL with the lexical strategy', async () => {
      const result = await createCliContainer({}).searchMenus(STRUCTURE, 'lexical');

      expect(result).toEqual({ ok: false, error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] } });
    });

    it.each(['semantic', 'hybrid'] as const)('asks for the Gemini key with the %s strategy', async (strategy) => {
      const result = await createCliContainer({ DATABASE_URL_UNPOOLED: UNREACHABLE }).searchMenus(STRUCTURE, strategy);

      expect(result).toEqual({ ok: false, error: { kind: 'missing-variables', names: ['GEMINI_API_KEY'] } });
    });

    it('never uses the pooled URL', async () => {
      const result = await createCliContainer({ DATABASE_URL: 'postgresql://pooled' }).searchMenus(STRUCTURE, 'lexical');

      expect(result).toEqual({ ok: false, error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] } });
    });
  });
});
