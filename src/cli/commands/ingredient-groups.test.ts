import { describe, expect, it } from 'vitest';
import type { ClassifyIngredientsError, ClassifyIngredientsSummary } from '@/application/dto/classify-ingredients';
import { runIngredientGroups } from '@/cli/commands/ingredient-groups';
import type { MissingVariables } from '@/composition/cli-container';
import { err, ok, type Result } from '@/shared/result';

const URL_WITH_PASSWORD = 'postgresql://owner:s3cr3t@ep-x.neon.tech/neondb';

const run = async (result: Result<ClassifyIngredientsSummary, ClassifyIngredientsError | MissingVariables>) => {
  const lines: string[] = [];
  const code = await runIngredientGroups({
    classifyIngredients: async () => result,
    print: (line) => lines.push(line),
  });
  return { code, text: lines.join('\n') };
};

describe('runIngredientGroups', () => {
  it('prints how many ingredient groups it classified and kept', async () => {
    const { code, text } = await run(
      ok({ ingredients: 267, classified: 267, kept: 0, model: 'gemini-3.8-flash' }),
    );

    expect(code).toBe(0);
    expect(text).toBe('Ingredient groups with gemini-3.8-flash for 267 ingredients: 267 classified, 0 kept.');
  });

  it('exits 1 and says what to run when the database has no ingredients', async () => {
    const { code, text } = await run(err({ kind: 'recipes-empty' }));

    expect(code).toBe(1);
    expect(text).toContain('The database has no recipes: run `pnpm ingest recipes` first.');
  });

  it('exits 1 and names the missing variables', async () => {
    const { code, text } = await run(err({ kind: 'missing-variables', names: ['GEMINI_API_KEY'] }));

    expect(code).toBe(1);
    expect(text).toContain('GEMINI_API_KEY');
  });

  it('exits 1, reports the classifier error and says the stored groups are unchanged', async () => {
    const { code, text } = await run(err({ kind: 'classifier-failed', reason: '503 Service Unavailable' }));

    expect(code).toBe(1);
    expect(text).toBe(
      'The classification service failed: 503 Service Unavailable\nThe stored ingredient groups are unchanged.',
    );
  });

  it('exits 1 and reports invalid classification output', async () => {
    const { code, text } = await run(err({ kind: 'invalid-classification', reason: 'missing ingredient: pollo' }));

    expect(code).toBe(1);
    expect(text).toBe(
      'The classification was invalid: missing ingredient: pollo\nThe stored ingredient groups are unchanged.',
    );
  });

  it('prints a database error without credentials', async () => {
    const { code, text } = await run(err({ kind: 'write-failed', reason: `connect failed: ${URL_WITH_PASSWORD}` }));

    expect(code).toBe(1);
    expect(text).toContain('The database failed: connect failed:');
    expect(text).not.toContain('s3cr3t');
  });
});
