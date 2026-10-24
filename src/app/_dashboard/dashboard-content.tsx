import { dashboardWeeksOf, listProgressOf, TodayBlock } from '@/app/_dashboard/dashboard-blocks';
import { webContainer } from '@/composition/web-container';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';
import { WeeksCard } from '@/features/dashboard/components/weeks-card';
import { ShoppingProgress } from '@/features/shopping-list/components/shopping-progress';
import type { SignedInUser } from '@/application/dto/signed-in-user';

/** Today and tomorrow, the two weeks and the current list, read in parallel; each block shows its own failure (design D2, D3 of MF-25). */
export async function dashboardContent(user: SignedInUser) {
  const container = webContainer();
  const [menu, weeks, list] = await Promise.all([
    container.todaysMenu({ userId: user.userId }),
    container.weeksToChoose({ userId: user.userId }),
    container.shoppingChecklist({ userId: user.userId }),
  ]);
  return (
    <DashboardLayout
      today={menu.ok ? menu.value.today : undefined}
      weeks={<WeeksCard weeks={dashboardWeeksOf(weeks)} />}
      meals={<TodayBlock menu={menu} weeks={weeks} />}
      shopping={<ShoppingProgress list={listProgressOf(list)} />}
    />
  );
}
