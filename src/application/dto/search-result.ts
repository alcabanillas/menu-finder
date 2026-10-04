import type { SearchRequestError } from '@/application/dto/search-request';

/** How a term is matched against a dish: by its text, by its embedding, or by the mean of both. */
export type SearchStrategy = 'lexical' | 'semantic' | 'hybrid';

/** The five best menus, how many tie with the first one, and the menus each hard constraint removes on its own. */
export type SearchResultDto = {
  strategy: SearchStrategy;
  menus: RankedMenuDto[];
  tiedWithFirst: number;
  removedBy: RemovedMenusDto[];
};

type RankedMenuDto = { menu: number; score: number; evidence: EvidenceDto[] };

/** For each unit of the request, the dish that gave its best score; none for a week-wide exclusion. */
type EvidenceDto = { constraints: string[]; dish: DishDto | null };

type DishDto = { day: string; meal: string; position: number; name: string };

type RemovedMenusDto = { constraints: string[]; menusRemoved: number };

export type SearchMenusError =
  | SearchRequestError
  | { kind: 'index-not-loaded'; message: string }
  | { kind: 'search-failed'; reason: string };
