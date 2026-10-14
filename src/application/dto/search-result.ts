import type { DecomposeError } from '@/application/dto/decomposition';
import type { SearchRequestDto, SearchRequestError } from '@/application/dto/search-request';
import type { DayDto } from '@/application/dto/weekly-menu';

/** How a term is matched against a dish: by its text, by its embedding, or by the mean of both. */
export type SearchStrategy = 'lexical' | 'semantic' | 'hybrid';

/**
 * The five best menus, how many tie with the first one, every ranked menu with its score (for the evaluation, which
 * needs the ties past the fifth), and the menus each hard constraint removes on its own.
 */
export type SearchResultDto = {
  strategy: SearchStrategy;
  /** The units the menus are scored on; the `evidence` of every menu follows their order. */
  units: UnitDto[];
  menus: RankedMenuDto[];
  tiedWithFirst: number;
  ranked: MenuScoreDto[];
  removedBy: RemovedMenusDto[];
};

type UnitDto = { kind: 'constraint' | 'sameDish' | 'anyOf'; constraints: string[] };

type MenuScoreDto = { menu: number; score: number };

type RankedMenuDto = { menu: number; score: number; evidence: EvidenceDto[] };

/** For each unit of the request, the dish that gave its best score; none for a week-wide exclusion. */
type EvidenceDto = { constraints: string[]; dish: DishDto | null };

type DishDto = { day: DayDto; meal: 'lunch' | 'dinner'; position: number; name: string };

type RemovedMenusDto = { constraints: string[]; menusRemoved: number };

export type SearchMenusError =
  | SearchRequestError
  | { kind: 'index-not-loaded'; message: string }
  | { kind: 'embedding-failed'; reason: string }
  | { kind: 'search-failed'; reason: string };

/** A search from the text of a request: the structure the decomposer returned and the ranking it gave. */
export type TextSearchDto = { structure: Required<SearchRequestDto>; result: SearchResultDto };

/**
 * Why a request gives no ranking: the decomposer gave no structure, its structure has no constraints (a valid
 * decomposition the search cannot use, MF-22.1 design D2), or the search failed.
 */
export type SearchByTextError = DecomposeError | { kind: 'nothing-to-search' } | SearchMenusError;

/** The web's search can also stop at the user's daily ceiling: nothing was sent to the model (spec rate-limiting). */
export type DailyLimitedSearchError = SearchByTextError | { kind: 'llm-limit-reached' };
