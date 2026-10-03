import type { WeeklyMenu } from '@/domain/menu/weekly-menu';
import { buildWeeklyMenu, type DishOutcome, type MenuCounts } from '@/domain/menu-ingestion/build-weekly-menu';
import type { DishResolution } from '@/domain/menu-ingestion/recipe-match';
import { err, ok, type Result } from '@/shared/result';
import type {
  DishQaRow,
  IngestMenusError,
  IngestMenusSummary,
  IngestMenusTotals,
  MenuFailure,
} from '@/application/dto/ingest-menus';
import type { DocumentSource, MenuFolder } from '@/application/ports/document-source';
import type { MenuRepository } from '@/application/ports/menu-repository';

export type IngestMenusDeps = { source: DocumentSource; menus: MenuRepository };

type ReadMenus = { weeklyMenus: WeeklyMenu[]; failures: MenuFailure[]; qaRows: DishQaRow[]; totals: IngestMenusTotals };

type MatchEvidence = Pick<DishQaRow, 'matchedRecipe' | 'score' | 'discardedCandidate' | 'discardedScore'>;

const NO_EVIDENCE: MatchEvidence = { matchedRecipe: null, score: null, discardedCandidate: null, discardedScore: null };

/**
 * Reads every menu of the source, builds its weekly menu and saves the menus
 * that could be read. Nothing is saved when no menu could be read.
 */
export async function ingestMenus({
  source,
  menus,
}: IngestMenusDeps): Promise<Result<IngestMenusSummary, IngestMenusError>> {
  const folders = await source.listMenuFolders();
  if (!folders.ok) return err({ kind: 'source-unavailable', error: folders.error });

  const { weeklyMenus, failures, qaRows, totals } = await readMenus(source, folders.value);
  if (weeklyMenus.length === 0) return err({ kind: 'no-menu-parsed', failures });

  const saved = await menus.saveAll(weeklyMenus);
  if (!saved.ok) return err({ kind: 'save-failed', error: saved.error });

  return ok({ failures, totals, qaRows, unresolved: qaRows.filter(isUnresolved) });
}

/** Reads and builds every menu in numeric order. A menu that fails is recorded and the others go on. */
async function readMenus(source: DocumentSource, folders: MenuFolder[]): Promise<ReadMenus> {
  const read: ReadMenus = { weeklyMenus: [], failures: [], qaRows: [], totals: emptyTotals(folders.length) };

  for (const folder of [...folders].sort((a, b) => a.number - b.number)) {
    const menu = await source.readMenu(folder);
    if (!menu.ok) {
      read.failures.push({ menu: folder.number, error: menu.error });
      continue;
    }
    const built = buildWeeklyMenu(folder.number, menu.value, await source.listRecipeFiles(folder));
    read.weeklyMenus.push(built.menu);
    read.qaRows.push(...built.dishes.map((dish) => toQaRow(folder.number, dish)));
    read.totals.menusProcessed += 1;
    addCounts(read.totals, built.counts);
  }
  return read;
}

function isUnresolved(row: DishQaRow): boolean {
  return row.hasRecipeMark && row.matchedRecipe === null;
}

function emptyTotals(menusFound: number): IngestMenusTotals {
  return {
    menusFound,
    menusProcessed: 0,
    emptySlots: 0,
    multiDishSlots: 0,
    resolved: 0,
    unmarked: 0,
    unresolved: 0,
    unclaimedRecipeFiles: 0,
  };
}

function toQaRow(menu: number, { day, type, position, name, resolution }: DishOutcome): DishQaRow {
  return {
    menu,
    day,
    type,
    position,
    dish: name,
    hasRecipeMark: resolution.status !== 'unmarked',
    ...matchEvidence(resolution),
  };
}

/** What the QA report shows of a dish's match: the accepted recipe, or the candidate discarded below the threshold. */
function matchEvidence(resolution: DishResolution): MatchEvidence {
  switch (resolution.status) {
    case 'resolved':
      return { ...NO_EVIDENCE, matchedRecipe: resolution.recipe, score: resolution.score };
    case 'unresolved':
      return {
        ...NO_EVIDENCE,
        discardedCandidate: resolution.discarded?.recipe ?? null,
        discardedScore: resolution.discarded?.score ?? null,
      };
    case 'unmarked':
      return NO_EVIDENCE;
  }
}

function addCounts(totals: IngestMenusTotals, counts: MenuCounts): void {
  for (const key of Object.keys(counts) as (keyof MenuCounts)[]) totals[key] += counts[key];
}
