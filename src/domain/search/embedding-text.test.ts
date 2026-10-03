import { describe, expect, it } from 'vitest';
import { embeddingDocument, embeddingSource } from '@/domain/search/embedding-text';

describe('embeddingDocument', () => {
  it('is the title and the ingredient names', () => {
    expect(embeddingDocument('Tortilla de patata', ['huevo', 'patata'])).toEqual({
      title: 'Tortilla de patata',
      content: 'huevo, patata',
    });
  });

  it('repeats the title as content when there are no ingredients', () => {
    expect(embeddingDocument('Fruta', [])).toEqual({ title: 'Fruta', content: 'Fruta' });
  });

  it('has a source text that changes when the title or the ingredients change', () => {
    const base = embeddingSource({ title: 'Tortilla', content: 'huevo' });

    expect(embeddingSource({ title: 'Tortilla', content: 'huevo' })).toBe(base);
    expect(embeddingSource({ title: 'Tortilla', content: 'huevo, patata' })).not.toBe(base);
    expect(embeddingSource({ title: 'Tortilla francesa', content: 'huevo' })).not.toBe(base);
  });
});
