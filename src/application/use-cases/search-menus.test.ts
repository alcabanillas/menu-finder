import { describe, expect, it } from 'vitest';
import type { SearchRequestDto } from '@/application/dto/search-request';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import { searchMenus } from '@/application/use-cases/search-menus';
import { err } from '@/shared/result';

const DTO = {
  constraints: [{ id: 'c1', type: 'literal', term: 'pollo', polarity: 'include', hard: false }],
  sameDish: [],
  anyOf: [],
} as unknown as SearchRequestDto;

function failingDeps(): FindMenusDeps {
  const reason = 'connection lost';
  return {
    menus: { list: async () => err({ kind: 'read-failed', reason }) },
    dishText: { matches: async () => err({ kind: 'text-search-failed', reason }) },
    recipeEmbeddings: {
      documents: async () => err({ kind: 'store-failed', reason }),
      saveAll: async () => err({ kind: 'store-failed', reason }),
      similarities: async () => err({ kind: 'store-failed', reason }),
    },
    embeddings: {
      model: 'test-model',
      embedDocuments: async () => err({ kind: 'embedding-failed', reason }),
      embedQueries: async () => err({ kind: 'embedding-failed', reason }),
    },
  };
}

describe('searchMenus', () => {
  it('returns the same search-failed result as findMenus when the menus cannot be listed', async () => {
    const viaUseCase = await searchMenus(DTO, 'lexical', failingDeps());

    expect(viaUseCase).toEqual(await findMenus(DTO, 'lexical', failingDeps()));
    expect(viaUseCase).toEqual({ ok: false, error: { kind: 'search-failed', reason: 'connection lost' } });
  });
});
