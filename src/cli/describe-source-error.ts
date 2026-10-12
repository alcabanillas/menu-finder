import type { SourceFailure } from '@/application/dto/ingest-failure';

/** One line saying why a PDF or its folder could not be read. */
export const describeSourceError = (error: SourceFailure): string => {
  switch (error.kind) {
    case 'missing-raw-directory':
      return `raw directory not found: ${error.path}`;
    case 'missing-file':
      return `${error.file} not found`;
    case 'unreadable-document':
      return `unreadable document: ${error.reason}`;
    case 'no-table':
      return 'no table found';
    case 'missing-header':
      return 'no Lunes..Domingo header row';
    case 'missing-meal-row':
      return `missing meal row (${error.meal})`;
    case 'missing-section':
      return `missing section (${error.section})`;
  }
};
