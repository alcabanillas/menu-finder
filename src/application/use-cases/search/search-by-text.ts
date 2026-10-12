import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchByTextError, SearchStrategy, TextSearchDto } from '@/application/dto/search-result';
import { decomposeText, type DecomposeTextDeps } from '@/application/services/search/decompose-text';
import { findMenus, type FindMenusDeps } from '@/application/services/search/find-menus';
import { err, ok, type Result } from '@/shared/result';

export type SearchByTextDeps = DecomposeTextDeps & FindMenusDeps;

/**
 * Searches the menus from the text of a request: one call to the model, then the search with its structure,
 * unchanged (spec menu-search, "Search from a request"). It calls services only, never another use case (ADR-001).
 */
export async function searchByText(
  request: string,
  strategy: SearchStrategy,
  deps: SearchByTextDeps,
): Promise<Result<TextSearchDto, SearchByTextError>> {
  const structure = await decomposeText(request, deps);
  if (!structure.ok) return structure;
  if (hasNothingToSearch(structure.value)) return err({ kind: 'nothing-to-search' });
  const result = await findMenus(structure.value, strategy, deps);
  if (!result.ok) return result;
  return ok({ structure: structure.value, result: result.value });
}

// A valid decomposition the search refuses ("platos para el finde"): stopped here, so that it neither reaches the
// database nor comes back as an invalid structure the user never wrote (MF-22.1 design D2). With no constraints there
// are no groups either: `decomposeText` refuses a group that names an unknown constraint.
function hasNothingToSearch({ constraints }: Required<SearchRequestDto>): boolean {
  return constraints.length === 0;
}
