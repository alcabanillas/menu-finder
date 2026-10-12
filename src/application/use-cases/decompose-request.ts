import type { DecomposeError } from '@/application/dto/decomposition';
import type { SearchRequestDto } from '@/application/dto/search-request';
import { decomposeText, type DecomposeTextDeps } from '@/application/services/search/decompose-text';
import type { Result } from '@/shared/result';

/** The entry the adapters call to turn a request into a search structure; it delegates to `decomposeText`. */
export function decomposeRequest(
  request: string,
  deps: DecomposeTextDeps,
): Promise<Result<Required<SearchRequestDto>, DecomposeError>> {
  return decomposeText(request, deps);
}
