import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import { createCliContainer } from '@/composition/cli-container';

const STRUCTURE: SearchRequestDto = {
  constraints: [{ id: 'c1', type: 'literal', term: 'pollo', polarity: 'include', hard: false }],
};

// The variables are checked before any connection is opened, so these tests need no database.
describe('createCliContainer search', () => {
  it('asks only for the direct database URL with the lexical strategy', async () => {
    const result = await createCliContainer({}).searchMenus(STRUCTURE, 'lexical');

    expect(result).toEqual({ ok: false, error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] } });
  });

  it.each(['semantic', 'hybrid'] as const)('asks for the Gemini key with the %s strategy', async (strategy) => {
    const result = await createCliContainer({ DATABASE_URL_UNPOOLED: 'postgresql://unused' }).searchMenus(
      STRUCTURE,
      strategy,
    );

    expect(result).toEqual({ ok: false, error: { kind: 'missing-variables', names: ['GEMINI_API_KEY'] } });
  });

  it('never uses the pooled URL', async () => {
    const result = await createCliContainer({ DATABASE_URL: 'postgresql://pooled' }).searchMenus(STRUCTURE, 'lexical');

    expect(result).toEqual({ ok: false, error: { kind: 'missing-variables', names: ['DATABASE_URL_UNPOOLED'] } });
  });
});
