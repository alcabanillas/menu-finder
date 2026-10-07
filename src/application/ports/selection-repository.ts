import type { RepositoryError, RepositoryReadError } from '@/application/ports/repository-error';
import type { LocalDate } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import type { Result } from '@/shared/result';

/** Why a choice could not be stored: no menu has that number, or the write failed. */
export type SelectionWriteError = { kind: 'unknown-menu' } | RepositoryError;

/** What the user chooses: a menu for the week that starts on `startsOn`. */
export type MenuChoice = { menuNumber: number; startsOn: LocalDate };

/** The users' menu selections. Every method works only on the rows of the given user. */
export interface SelectionRepository {
  /** The user's selections starting on `from` or later, ordered by start date. */
  listFrom(userId: string, from: LocalDate): Promise<Result<Selection[], RepositoryReadError>>;
  /** Stores the choice, replacing the user's selection of the same start date with a new one. */
  replace(userId: string, choice: MenuChoice): Promise<Result<Selection, SelectionWriteError>>;
}
