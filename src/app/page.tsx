import { signOutAction } from '@/app/_auth/actions';
import { sessionUser } from '@/app/_auth/session-user';
import { APP_VERSION } from '@/app/app-version';
import { webContainer } from '@/composition/web-container';
import { AppShell } from '@/features/app-shell/components/app-shell';
import { DashboardLayout } from '@/features/dashboard/components/dashboard-layout';
import { NoMenuNotice, type EmptyWeek } from '@/shared/ui/no-menu-notice';
import { WeeksCard, type DashboardWeeks } from '@/features/dashboard/components/weeks-card';
import { ShoppingProgress, type ListProgress } from '@/features/shopping-list/components/shopping-progress';
import { TodayMeals } from '@/features/weekly-menu/components/today-meals';
import { WelcomeScreen } from '@/features/welcome/components/welcome-screen';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';

type WeekRead = Awaited<ReturnType<ReturnType<typeof webContainer>['menuWeekPage']>>;
type WeeksRead = Awaited<ReturnType<ReturnType<typeof webContainer>['weeksToChoose']>>;
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

/** This week's menu, the two weeks and the current list, read in parallel; each block shows its own failure (design D2, D3 of MF-25). */
async function dashboardOf(user: SignedInUser) {
  const container = webContainer();
  const [week, weeks, list] = await Promise.all([
    container.menuWeekPage({ userId: user.userId, startsOn: undefined }),
    container.weeksToChoose({ userId: user.userId }),
    container.shoppingChecklist({ userId: user.userId }),
  ]);
  return (
    <AppShell account={{ email: user.email, version: APP_VERSION, signOutAction }}>
      <DashboardLayout
        today={week.ok ? week.value.today : undefined}
        weeks={<WeeksCard weeks={dashboardWeeksOf(weeks)} />}
        meals={<TodayBlock week={week} weeks={weeks} />}
        shopping={<ShoppingProgress list={listProgressOf(list)} />}
      />
    </AppShell>
  );
}

/** Today's dishes; with no menu this week, what the user can do instead; or the failure of a read it needs. */
function TodayBlock({ week, weeks }: { week: WeekRead; weeks: WeeksRead }) {
  if (week.ok && week.value.menu) return <TodayMeals menu={week.value.menu} />;
  if (week.ok && weeks.ok) return <NoMenuNotice week={emptyWeekOf(weeks.value)} tone="olive" className="mt-5" />;
  return <p className="mt-4">No se ha podido cargar tu menú.</p>;
}

function dashboardWeeksOf(weeks: WeeksRead): DashboardWeeks {
  return weeks.ok ? { kind: 'read', weeks: weeks.value } : { kind: 'failed' };
}

function emptyWeekOf({ current, next }: WeeksToChooseDto): EmptyWeek {
  if (!current.locked || next.menuNumber === null) return { kind: 'open' };
  return { kind: 'locked', nextMenuNumber: next.menuNumber, nextStartsOn: next.startsOn };
}

function listProgressOf(list: ListRead): ListProgress {
  if (!list.ok) return { kind: 'failed' };
  if (!list.value) return { kind: 'none' };
  const { startsOn, checkedCount, total } = list.value;
  return { kind: 'list', startsOn, checkedCount, total };
}