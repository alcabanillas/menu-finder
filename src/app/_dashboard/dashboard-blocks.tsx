import type { webContainer } from '@/composition/web-container';
import type { DashboardWeeks } from '@/features/dashboard/components/weeks-card';
import type { ListProgress } from '@/features/shopping-list/components/shopping-progress';
import { TodayMeals } from '@/features/weekly-menu/components/today-meals';
import { NoMenuNotice, type EmptyWeek } from '@/shared/ui/no-menu-notice';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';

type WeekRead = Awaited<ReturnType<ReturnType<typeof webContainer>['menuWeekPage']>>;
type WeeksRead = Awaited<ReturnType<ReturnType<typeof webContainer>['weeksToChoose']>>;
type ListRead = Awaited<ReturnType<ReturnType<typeof webContainer>['shoppingChecklist']>>;

/** Today's dishes; with no menu this week, what the user can do instead; or the failure of a read it needs. */
export function TodayBlock({ week, weeks }: { week: WeekRead; weeks: WeeksRead }) {
  if (week.ok && week.value.menu) return <TodayMeals menu={week.value.menu} />;
  if (week.ok && weeks.ok) return <NoMenuNotice week={emptyWeekOf(weeks.value)} tone="olive" className="mt-5" />;
  return <p className="mt-4">No se ha podido cargar tu menú.</p>;
}

/** The weeks card's state: the two weeks read, or the failure of that read. */
export function dashboardWeeksOf(weeks: WeeksRead): DashboardWeeks {
  return weeks.ok ? { kind: 'read', weeks: weeks.value } : { kind: 'failed' };
}

function emptyWeekOf({ current, next }: WeeksToChooseDto): EmptyWeek {
  if (!current.locked || next.menuNumber === null) return { kind: 'open' };
  return { kind: 'locked', nextMenuNumber: next.menuNumber, nextStartsOn: next.startsOn };
}

/** The shopping progress card's state: the current list, none, or the failure of the read. */
export function listProgressOf(list: ListRead): ListProgress {
  if (!list.ok) return { kind: 'failed' };
  if (!list.value) return { kind: 'none' };
  const { startsOn, checkedCount, total } = list.value;
  return { kind: 'list', startsOn, checkedCount, total };
}
