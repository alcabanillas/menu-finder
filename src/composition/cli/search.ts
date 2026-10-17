import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchStrategy } from '@/application/dto/search-result';
import { decomposeRequest } from '@/application/use-cases/search/decompose-request';
import { searchByText } from '@/application/use-cases/search/search-by-text';
import { searchMenus } from '@/application/use-cases/search/search-menus';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { createGenkitRequestDecomposer } from '@/infrastructure/genkit/genkit-request-decomposer';
import { DATABASE_URL, GEMINI_API_KEY, requiring, type Env } from './requiring';
import { NO_EMBEDDINGS, searchPorts } from './search-ports';
import { withPool } from './with-pool';

/** Search commands wired to their database and Genkit adapters. */
export function searchCommands(env: Env) {
  return {
    // Always the direct URL; the key only for the strategies that embed the terms (spec menu-search, R6).
    searchMenus: (dto: SearchRequestDto, strategy: SearchStrategy) =>
      requiring(env, strategy === 'lexical' ? [DATABASE_URL] : [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          searchMenus(dto, strategy, searchPorts(pool, apiKey === undefined ? NO_EMBEDDINGS : createGenkitEmbeddings(apiKey))),
        ),
      ),
    // Both variables before the model is called, with every strategy: the decomposer needs the key (MF-22.1 design D5).
    // `pg` opens no connection until the first query, which the use case only makes after a structure with constraints.
    // No daily LLM limit, as in `decompose`: it is applied in the web adapter (SEG-rate-limit).
    searchByText: (request: string, strategy: SearchStrategy) =>
      requiring(env, [DATABASE_URL, GEMINI_API_KEY], ([url, apiKey]) =>
        withPool(url, (pool) =>
          searchByText(request, strategy, {
            decomposer: createGenkitRequestDecomposer(apiKey),
            ...searchPorts(pool, createGenkitEmbeddings(apiKey)),
          }),
        ),
      ),
    // The key only, no database (spec request-decomposer). No daily LLM limit: it is applied in the web adapter (SEG-rate-limit).
    decomposeRequest: (request: string) =>
      requiring(env, [GEMINI_API_KEY], ([apiKey]) =>
        decomposeRequest(request, { decomposer: createGenkitRequestDecomposer(apiKey) }),
      ),
  };
}
