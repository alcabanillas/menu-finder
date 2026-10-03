import { describe, expect, it } from 'vitest';
import type { EmbedRecipesError, EmbedRecipesSummary } from '@/application/dto/embed-recipes';
import { runEmbed } from '@/cli/commands/embed';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const URL_WITH_PASSWORD = 'postgresql://owner:s3cr3t@ep-x.neon.tech/neondb';

const embed = async (result: Result<EmbedRecipesSummary, EmbedRecipesError | MissingVariables>) => {
  const lines: string[] = [];
  const code = await runEmbed({ embedRecipes: async () => result, print: (line) => lines.push(line) });
  return { code, text: lines.join('\n') };
};

describe('runEmbed', () => {
  it('prints how many embeddings it computed and kept', async () => {
    const { code, text } = await embed(ok({ recipes: 448, embedded: 2, kept: 446, model: 'gemini-embedding-2' }));

    expect(code).toBe(0);
    expect(text).toBe('Embeddings with gemini-embedding-2 for 448 recipe rows: 2 computed, 446 kept.');
  });

  it('exits 1 and says what to run when the database has no recipes', async () => {
    const { code, text } = await embed(ok({ recipes: 0, embedded: 0, kept: 0, model: 'gemini-embedding-2' }));

    expect(code).toBe(1);
    expect(text).toContain('run `pnpm ingest recipes` and `pnpm ingest menu` first');
  });

  it('exits 1 and names the missing variables', async () => {
    const { code, text } = await embed(err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }));

    expect(code).toBe(1);
    expect(text).toContain('GEMINI_API_KEY');
  });

  it('exits 1, reports the service error and says the stored embeddings are unchanged', async () => {
    const { code, text } = await embed(err({ kind: 'embedding-failed', reason: '503 Service Unavailable' }));

    expect(code).toBe(1);
    expect(text).toBe('The embedding service failed: 503 Service Unavailable\nThe stored embeddings are unchanged.');
  });

  it('prints a database error without the credentials', async () => {
    const { code, text } = await embed(err({ kind: 'store-failed', reason: `connect failed: ${URL_WITH_PASSWORD}` }));

    expect(code).toBe(1);
    expect(text).toContain('The database failed: connect failed:');
    expect(text).not.toContain('s3cr3t');
  });
});
