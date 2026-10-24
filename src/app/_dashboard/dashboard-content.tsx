import { dashboardWeeksOf, listProgressOf, TodayBlock } from '@/app/_dashboard/dashboard-blocks';
import { webContainer } from '@/composition/web-container';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';
import { WeeksCard } from '@/features/dashboard/components/weeks-card';
import { ShoppingProgress } from '@/features/shopping-list/components/shopping-progress';
import type { SignedInUser } from '@/application/dto/signed-in-user';

/** This week's menu, the two weeks and the current list, read in parallel; each block shows its own failure (design D2, D3 of MF-25). */
export async function dashboardContent(user: SignedInUser) {
  const container = webContainer();
  const [week, weeks, list] = await Promise.all([
    container.menuWeekPage({ userId: user.userId, startsOn: undefined }),
    container.weeksToChoose({ userId: user.userId }),
    container.shoppingChecklist({ userId: user.userId }),
  ]);
  return (
    <DashboardLayout
      today={week.ok ? week.value.today : undefined}
      weeks={<WeeksCard weeks={dashboardWeeksOf(weeks)} />}
      meals={<TodayBlock week={week} weeks={weeks} />}
      shopping={<ShoppingProgress list={listProgressOf(list)} />}
    />
  );
}
