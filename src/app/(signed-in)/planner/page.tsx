import { chooseMenuAction, searchMenusAction } from '@/app/(signed-in)/planner/actions';
import { requireUser } from '@/app/_auth/require-user';
import { weekInput } from '@/application/dto/week-input';
import { webContainer } from '@/composition/web-container';
import { PlannerSearch } from '@/features/menu-planner/components/planner-search';
import { StackTraceCheckButton } from '@/features/menu-planner/components/stack-trace-check-button';

type PlannerPageProps = { searchParams: Promise<{ week?: string | string[] }> };

/**
 * `/planner`: protected, inside the app shell (MF-51.1). The week selector, the search, the random button and the choose
 * buttons of the cards (MF-22.5). It has no visible title: the active tab says where the user is, and a heading is there
 * for screen readers. `?week=current|next` (the link of an empty week in Menú) starts the selector on that week.
 */
export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const user = await requireUser();
  const [weeks, { week }] = await Promise.all([webContainer().weeksToChoose({ userId: user.userId }), searchParams]);
  const asked = weekInput.safeParse(week);
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-5 @min-[640px]:py-8">
      <h1 className="sr-only">Buscar menú</h1>
      <PlannerSearch
        action={searchMenusAction}
        chooseAction={chooseMenuAction}
        weeks={weeks.ok ? weeks.value : null}
        initialWeek={asked.success ? asked.data : undefined}
      />
      <StackTraceCheckButton />
    </div>
  );
}
