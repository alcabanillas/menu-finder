import { requireUser } from '@/app/_session/require-user';
import { webContainer } from '@/composition/web-container';
import { EmptyMenu } from '@/features/weekly-menu/components/empty-menu';
import { WeeklyMenu } from '@/features/weekly-menu/components/weekly-menu';

/**
 * `/menu`: protected, inside the app shell (MF-51.1). The user's menu of this week, one day at a time (MF-23.1). It
 * declares no `searchParams`: the user comes from the session and nothing from the URL reaches the use case.
 */
export default async function MenuPage() {
  const user = await requireUser();
  const menu = await webContainer().activeMenu({ userId: user.userId });
  if (!menu.ok) return <EmptyMenu reason="failed" />;
  return menu.value ? <WeeklyMenu menu={menu.value} /> : <EmptyMenu reason="none" />;
}
