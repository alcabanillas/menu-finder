import type { WeeklyMenu } from "@/domain/menu/weekly-menu";
import { buildWeeklyMenu, type DishOutcome } from "@/domain/menu-ingestion/build-weekly-menu";
import { err, ok, type Result } from "@/shared/result";
import type {
  DishQaRow,
  IngestMenusError,
  IngestMenusSummary,
  IngestMenusTotals,
  MenuFailure,
} from "../dto/ingest-menus";
import type { DocumentSource } from "../ports/document-source";
import type { MenuRepository } from "../ports/menu-repository";

export type IngestMenusDeps = { source: DocumentSource; menus: MenuRepository };

const toQaRow = (menu: number, { day, type, position, name, resolution }: DishOutcome): DishQaRow => ({
  menu,
  day,
  type,
  position,
  dish: name,
  hasRecipeMark: resolution.status !== "unmarked",
  matchedRecipe: resolution.status === "resolved" ? resolution.recipe : null,
  score: resolution.status === "resolved" ? resolution.score : null,
  discardedCandidate: resolution.status === "unresolved" ? (resolution.discarded?.recipe ?? null) : null,
  discardedScore: resolution.status === "unresolved" ? (resolution.discarded?.score ?? null) : null,
});

/**
 * Reads every menu of the source in numeric order, builds its weekly menu and
 * saves the menus that could be read. A menu that fails is recorded and the
 * others go on; nothing is saved when no menu could be read.
 */
export async function ingestMenus({
  source,
  menus,
}: IngestMenusDeps): Promise<Result<IngestMenusSummary, IngestMenusError>> {
  const folders = await source.listMenuFolders();
  if (!folders.ok) return err({ kind: "source-unavailable", error: folders.error });

  const ordered = [...folders.value].sort((a, b) => a.number - b.number);
  const weeklyMenus: WeeklyMenu[] = [];
  const failures: MenuFailure[] = [];
  const qaRows: DishQaRow[] = [];
  const totals: IngestMenusTotals = {
    menusFound: ordered.length,
    menusProcessed: 0,
    emptySlots: 0,
    multiDishSlots: 0,
    resolved: 0,
    unmarked: 0,
    unresolved: 0,
    unclaimedRecipeFiles: 0,
  };

  for (const folder of ordered) {
    const read = await source.readMenu(folder);
    if (!read.ok) {
      failures.push({ menu: folder.number, error: read.error });
      continue;
    }
    const built = buildWeeklyMenu(folder.number, read.value, await source.listRecipeFiles(folder));
    weeklyMenus.push(built.menu);
    qaRows.push(...built.dishes.map((dish) => toQaRow(folder.number, dish)));
    totals.menusProcessed++;
    for (const key of Object.keys(built.counts) as (keyof typeof built.counts)[]) totals[key] += built.counts[key];
  }

  if (weeklyMenus.length === 0) return err({ kind: "no-menu-parsed", failures });

  const saved = await menus.saveAll(weeklyMenus);
  if (!saved.ok) return err({ kind: "save-failed", error: saved.error });

  const unresolved = qaRows.filter((row) => row.hasRecipeMark && row.matchedRecipe === null);
  return ok({ failures, totals, qaRows, unresolved });
}
