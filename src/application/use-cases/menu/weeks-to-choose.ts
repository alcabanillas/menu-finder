import type { Clock } from '@/application/ports/clock';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { WeekToChooseDto, WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { LocalDate } from '@/domain/selection/local-date';
import { addDays, mondayOf } from '@/domain/selection/local-date';
import type { Selection } from '@/domain/selection/selection';
import { isLocked, mondayOfWeek, suggestedWeek, type Week } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** Whose weeks are asked for: the user id comes from the session. */
export type WeeksToChooseInput = { userId: string };

/** The selections could not be read: a fault of the system. */
export type WeeksToChooseFailure = { kind: 'failed' };

// Sunday is six days after Monday.
const LAST_DAY = 6;

type Deps = { selections: SelectionRepository; clock: Clock };

/** This week and next week for the selector: each one's menu and lock, and the week the choice starts on. */
export async function weeksToChoose(
  { selections, clock }: Deps,
  { userId }: WeeksToChooseInput,
): Promise<Result<WeeksToChooseDto, WeeksToChooseFailure>> {
  const today = clock.today();
  const fromThisMonday = await selections.listFrom(userId, mondayOf(today));
  if (!fromThisMonday.ok) return err({ kind: 'failed' });

  return ok({
    current: weekOf('current', fromThisMonday.value, today),
    next: weekOf('next', fromThisMonday.value, today),
    suggested: suggestedWeek(fromThisMonday.value, today),
  });
}

function weekOf(week: Week, selections: Selection[], today: LocalDate): WeekToChooseDto {
  const startsOn = mondayOfWeek(today, week);
  const chosen = selections.find((selection) => selection.startsOn === startsOn);
  return { startsOn, endsOn: addDays(startsOn, LAST_DAY), menuNumber: chosen?.menuNumber ?? null, locked: isLocked(week, selections, today) };
}
