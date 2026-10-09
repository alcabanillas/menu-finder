import { requireUser } from '@/app/_session/require-user';
import { webContainer } from '@/composition/web-container';
import { EmptyMenu } from '@/features/weekly-menu/components/empty-menu';
import { WeekNav } from '@/features/weekly-menu/components/week-nav';
import { WeeklyMenu } from '@/features/weekly-menu/components/weekly-menu';

type MenuPageProps = {
  searchParams: Promise<{ startsOn?: string | string[] }>;
};

/**
 * `/menu`: protected, inside the app shell (MF-51.1). One week of the user's menu at a time (MF-23.1), chosen with
 * `startsOn` (MF-55). The user comes from the session; the week is validated by the use case, and an invalid value
 * shows this week. Nothing else of the URL is read.
 */
export default async function MenuPage({ searchParams }: MenuPageProps) {
  const user = await requireUser();
  const { startsOn } = await searchParams;
  const page = await webContainer().menuWeekPage({ userId: user.userId, startsOn });
  if (!page.ok) return <EmptyMenu status="failed" />;

  const { navigation, menu } = page.value;
  const nav = <WeekNav {...navigation} />;
  if (menu) return <WeeklyMenu menu={menu} nav={nav} />;
  return <EmptyMenu status={navigation.status} days={navigation.days} nav={nav} />;
}
