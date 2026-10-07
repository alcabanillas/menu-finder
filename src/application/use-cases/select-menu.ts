import { z } from 'zod';
import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository, SelectionWriteError } from '@/application/ports/selection-repository';
import { mondayOf } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { startsOnFor } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** What a form or a direct call sends: the menu number is not trusted, the user id comes from the session. */
export type SelectMenuInput = { userId: string; menuNumber?: unknown };

/** `invalid-menu`: not a positive integer; `unknown-menu`: no menu has that number; `failed`: a fault of the system. */
export type SelectMenuFailure = { kind: 'invalid-menu' } | { kind: 'unknown-menu' } | { kind: 'failed' };

type Deps = { selections: SelectionRepository; clock: Clock };

const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// A form sends strings: only digits are accepted, so "12abc" and "1.5" are refused instead of half-parsed.
export const positiveIntegerInput = z.union([
  positiveSafeInteger,
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(positiveSafeInteger),
]);

/**
 * Stores the user's choice of a menu. The start date is computed here from today, never read from the request:
 * this week's Monday if the user has no menu on it, otherwise next Monday, replacing a choice already made for it.
 */
export async function selectMenu(
  { selections, clock }: Deps,
  { userId, menuNumber }: SelectMenuInput,
): Promise<Result<Selection, SelectMenuFailure>> {
  const parsed = positiveIntegerInput.safeParse(menuNumber);
  if (!parsed.success) return err({ kind: 'invalid-menu' });

  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  if (!fromThisMonday.ok) return err({ kind: 'failed' });

  const stored = await selections.replace(userId, {
    menuNumber: parsed.data,
    startsOn: startsOnFor(today, fromThisMonday.value),
  });
  return stored.ok ? ok(stored.value) : err(toFailure(stored.error));
}

function toFailure(error: SelectionWriteError): SelectMenuFailure {
  return error.kind === 'unknown-menu' ? { kind: 'unknown-menu' } : { kind: 'failed' };
}
