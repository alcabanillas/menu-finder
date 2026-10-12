import type { MealType } from '@/domain/menu/weekly-menu';

/**
 * Why a PDF or its folder could not be read, as the ingest commands see it. The same kinds as the document source
 * reports: the use case returns them here, and the compiler keeps both in step (MF-59.4).
 */
export type SourceFailure =
  | { kind: 'missing-raw-directory'; path: string }
  | { kind: 'missing-file'; file: string }
  | { kind: 'unreadable-document'; reason: string }
  | { kind: 'no-table' }
  | { kind: 'missing-header' }
  | { kind: 'missing-meal-row'; meal: MealType }
  | { kind: 'missing-section'; section: 'ingredients' };

/** The parsed documents could not be saved. */
export type SaveFailure = { kind: 'write-failed'; reason: string };
