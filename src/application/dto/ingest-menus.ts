import type { Day, MealType } from "@/domain/menu/weekly-menu";
import type { RepositoryError } from "@/application/ports/repository-error";
import type { SourceError } from "@/application/ports/document-source";

export type MenuFailure = { menu: number; error: SourceError };

/** One dish of a parsed menu, with the match evidence the saved menu does not keep. */
export type DishQaRow = {
  menu: number;
  day: Day;
  type: MealType;
  position: number;
  dish: string;
  hasRecipeMark: boolean;
  /** Only for resolved dishes. */
  matchedRecipe: string | null;
  score: number | null;
  /** Only for unresolved marked dishes that had a candidate below the threshold. */
  discardedCandidate: string | null;
  discardedScore: number | null;
};

export type IngestMenusTotals = {
  menusFound: number;
  menusProcessed: number;
  emptySlots: number;
  multiDishSlots: number;
  resolved: number;
  unmarked: number;
  unresolved: number;
  unclaimedRecipeFiles: number;
};

export type IngestMenusSummary = {
  failures: MenuFailure[];
  totals: IngestMenusTotals;
  qaRows: DishQaRow[];
  /** The QA rows of the unresolved marked dishes. */
  unresolved: DishQaRow[];
};

export type IngestMenusError =
  | { kind: "source-unavailable"; error: SourceError }
  | { kind: "no-menu-parsed"; failures: MenuFailure[] }
  | { kind: "save-failed"; error: RepositoryError };
