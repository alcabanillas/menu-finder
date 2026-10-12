import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchMenusError, SearchResultDto, SearchStrategy } from '@/application/dto/search-result';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import type { Result } from '@/shared/result';

/** The entry the adapters call; the search itself is the service findMenus. */
export function searchMenus(
  dto: SearchRequestDto,
  strategy: SearchStrategy,
  deps: FindMenusDeps,
): Promise<Result<SearchResultDto, SearchMenusError>> {
  return findMenus(dto, strategy, deps);
}
