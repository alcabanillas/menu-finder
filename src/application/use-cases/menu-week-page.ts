import type { WeekNavigationDto, WeekStatusDto } from '@/application/dto/week-navigation';
import type { Clock } from '@/application/ports/clock';
import type { MenuRepository } from '@/application/ports/menu-repository';
import type { RecipeRepository } from '@/application/ports/recipe-repository';
import type { SelectionRepository } from '@/application/ports/selection-repository';
import type { WeekFailure } from '@/application/use-cases/selected-week';
import { weekMenu } from '@/application/use-cases/week-menu';
import type { MenuWeek } from '@/domain/menu/menu-week';
import { mondayOf, type LocalDate } from '@/domain/selection/local-date';
import { neighbouringWeeks, resolveStartsOn } from '@/domain/selection/starts-on';
import { weekDates } from '@/domain/selection/week';
import { err, ok, type Result } from '@/shared/result';

/** Whose week is asked for; `startsOn` is the raw query value and is validated here, never trusted. */
export type MenuWeekPageInput = { userId: string; startsOn: unknown };

export type MenuWeekPage = { navigation: WeekNavigationDto; menu: MenuWeek | null };

type Deps = {
  selections: SelectionRepository;
  clock: Clock;
  menus: Pick<MenuRepository, 'find'>;
  recipes: Pick<RecipeRepository, 'findByFiles'>;
};

/** The week `/menu` shows: the validated `startsOn` (or this week), its menu if any, and the header's neighbours. */
export async function menuWeekPage(deps: Deps, input: MenuWeekPageInput): Promise<Result<MenuWeekPage, WeekFailure>> {
  const today = deps.clock.today();
  const shown = resolveStartsOn(input.startsOn, today);
  const menu = await weekMenu(deps, { userId: input.userId, startsOn: shown });
  if (!menu.ok) return err({ kind: 'failed' });
  return ok({ navigation: navigationOf(shown, today), menu: menu.value });
}

function navigationOf(shown: LocalDate, today: LocalDate): WeekNavigationDto {
  const current = mondayOf(today);
  return {
    shown,
    current,
    ...neighbouringWeeks(shown, today),
    status: statusOf(shown, current),
    days: weekDates(shown),
  };
}

function statusOf(shown: LocalDate, current: LocalDate): WeekStatusDto {
  if (shown === current) return 'current';
  return shown < current ? 'past' : 'future';
}
