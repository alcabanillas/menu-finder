import { requireUser } from '@/app/_auth/require-user';
import type { LockedByDto, WeekNavigationDto } from '@/application/dto/week-navigation';
import { webContainer } from '@/composition/web-container';
import { EmptyMenu } from '@/features/weekly-menu/components/empty-menu';
import { WeekNav } from '@/features/weekly-menu/components/week-nav';
import { WeeklyMenu } from '@/features/weekly-menu/components/weekly-menu';
import type { EmptyWeek } from '@/shared/ui/no-menu-notice';

// The header of the shell is a centred 1440 px box with 32 px of margin; the page has the same box with or without a menu
// (design D5 of MF-74). Below 800 px it is the narrow column of the mock.
const PAGE = 'mx-auto w-full max-w-[var(--spacing-content-max)] @min-[800px]:max-w-[1440px]';

type MenuPageProps = {
  searchParams: Promise<{ startsOn?: string | string[] }>;
};

/**
 * `/menu`: protected, inside the app shell (MF-51.1). One week of the user's menu at a time (MF-23.1), chosen with
 * `startsOn` (MF-55). The user comes from the session; the week is validated by the use case, and an invalid value
 * shows this week. Nothing else of the URL is read.
 */
export default async function MenuPage({ searchParams }: MenuPageProps) {
  return <div className={PAGE}>{await pageContent(searchParams)}</div>;
}

async function pageContent(searchParams: MenuPageProps['searchParams']) {
  const user = await requireUser();
  const { startsOn } = await searchParams;
  const page = await webContainer().menuWeekPage({ userId: user.userId, startsOn });
  if (!page.ok) return <EmptyMenu week="failed" />;

  const { navigation, menu, lockedBy } = page.value;
  const nav = <WeekNav {...navigation} />;
  if (menu) return <WeeklyMenu menu={menu} nav={nav} />;
  return <EmptyMenu week={emptyWeekOf(navigation, lockedBy)} days={navigation.days} nav={nav} />;
}

/** Why the week on show has no menu. The links of the notice come from these dates, never from the request. */
function emptyWeekOf({ status, shown }: WeekNavigationDto, lockedBy: LockedByDto | null): EmptyWeek {
  if (status === 'past') return { kind: 'past' };
  if (status === 'future') return { kind: 'future', startsOn: shown };
  if (lockedBy) return { kind: 'locked', nextMenuNumber: lockedBy.menuNumber, nextStartsOn: lockedBy.startsOn };
  return { kind: 'open' };
}
