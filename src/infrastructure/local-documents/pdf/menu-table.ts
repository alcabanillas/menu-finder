import type { SourceError } from '@/application/ports/document-source';
import type { Day, MealType } from '@/domain/menu/weekly-menu';
import type { SourceMeal, SourceMenu } from '@/domain/menu/source-menu';
import { err, ok, type Result } from '@/shared/result';
import { splitCellIntoDishes } from '@/infrastructure/local-documents/pdf/split-cell';

/** Lowercase, accent-free table label, punctuation kept: used to recognise day and meal rows. */
export const normalizeLabel = (label: string | undefined): string =>
  (label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Header labels in column order (columns 2 to 8), already normalized. */
const DAY_COLUMNS: readonly [label: string, day: Day][] = [
  ['lunes', 'monday'],
  ['martes', 'tuesday'],
  ['miercoles', 'wednesday'],
  ['jueves', 'thursday'],
  ['viernes', 'friday'],
  ['sabado', 'saturday'],
  ['domingo', 'sunday'],
];

const MEAL_ROWS: readonly [label: string, type: MealType][] = [
  ['comida', 'lunch'],
  ['cena', 'dinner'],
];

const isHeaderRow = (row: string[]): boolean =>
  DAY_COLUMNS.every(([label], index) => normalizeLabel(row[index + 1]) === label);

/**
 * Reads the weekly menu table of the nutritionist's PDF: a header row with the
 * days in columns 2 to 8, and the `Comida` and `Cena` rows labelled in column
 * 1. Every other row (breakfast, snacks) is ignored.
 */
export function toSourceMenu(table: string[][]): Result<SourceMenu, SourceError> {
  if (!table.some(isHeaderRow)) return err({ kind: 'missing-header' });

  const meals: SourceMeal[] = [];
  for (const [label, type] of MEAL_ROWS) {
    const row = table.find((cells) => normalizeLabel(cells[0]) === label);
    if (!row) return err({ kind: 'missing-meal-row', meal: type });
    DAY_COLUMNS.forEach(([, day], index) => {
      meals.push({ day, type, dishes: splitCellIntoDishes(row[index + 1] ?? '') });
    });
  }
  return ok({ meals });
}
