import { signOutAction } from '@/app/_auth/actions';
import { sessionUser } from '@/app/_auth/session-user';
import { APP_VERSION } from '@/app/app-version';
import { webContainer } from '@/composition/web-container';
import { AppShell } from '@/features/app-shell/components/app-shell';
import { ActiveMenuCard, type ActiveMenu } from '@/features/dashboard/components/active-menu-card';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';
import { ShoppingProgress, type ListProgress } from '@/features/shopping-list/components/shopping-progress';
import { TodayMeals } from '@/features/weekly-menu/components/today-meals';
import { WelcomeScreen } from '@/features/welcome/components/welcome-screen';
import type { SignedInUser } from '@/application/dto/signed-in-user';

type WeekRead = Awaited<ReturnType<ReturnType<typeof webContainer>['menuWeekPage']>>;
type ListRead = Awaited<ReturnType<ReturnType<typeof webContainer>['shoppingChecklist']>>;

/**
 * `/`: two states decided on the server from the session alone (UI-home-sin-login). A visitor gets the informative home
 * in the shell's variant with no session; a signed-in user gets the dashboard. It reads nothing of the request but the
 * session, and it is outside the `(signed-in)` route group because it also serves the visitor (design D11 of MF-51.1).
 */
export default async function Home() {
  const user = await sessionUser();
  if (!user) {
    return (
      <AppShell>
        <WelcomeScreen />
      </AppShell>
    );
  }
  return dashboardOf(user);
}

/** This week's menu and the current list, read in parallel; each block shows its own failure (design D2, D3 of MF-25). */
async function dashboardOf(user: SignedInUser) {
  const container = webContainer();
  const [week, list] = await Promise.all([
    container.menuWeekPage({ userId: user.userId, startsOn: undefined }),
    container.shoppingChecklist({ userId: user.userId }),
  ]);
  const menu = week.ok ? week.value.menu : null;
  return (
    <AppShell account={{ email: user.email, version: APP_VERSION, signOutAction }}>
      <DashboardLayout
        today={menu?.today}
        menu={<ActiveMenuCard menu={activeMenuOf(week)} />}
        meals={menu && <TodayMeals menu={menu} />}
        shopping={<ShoppingProgress list={listProgressOf(list)} />}
      />
    </AppShell>
  );
}

function activeMenuOf(week: WeekRead): ActiveMenu {
  if (!week.ok) return { kind: 'failed' };
  const { menu, navigation } = week.value;
  if (!menu) return { kind: 'none' };
  const [firstDate] = navigation.days;
  return { kind: 'chosen', menuNumber: menu.menuNumber, firstDate, lastDate: navigation.days.at(-1) ?? firstDate };
}

function listProgressOf(list: ListRead): ListProgress {
  if (!list.ok) return { kind: 'failed' };
  if (!list.value) return { kind: 'none' };
  return { kind: 'list', checkedCount: list.value.checkedCount, total: list.value.total };
}
