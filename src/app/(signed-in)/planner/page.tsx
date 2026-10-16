import { chooseRandomMenuAction, searchMenusAction } from '@/app/(signed-in)/planner/actions';
import { requireUser } from '@/app/_auth/require-user';
import { webContainer } from '@/composition/web-container';
import { PlannerSearch } from '@/features/menu-planner/components/planner-search';
import { RandomMenuForm } from '@/features/menu-planner/components/random-menu-form';
import { SelectionSummary } from '@/features/menu-planner/components/selection-summary';

/**
 * `/planner`: protected, inside the app shell (MF-51.1). The provisional planner of MF-43: this week's and next week's
 * menu, and a button that chooses one at random (MF-43.2), under the search of MF-22.4. MF-22.5 removes the button.
 */
export default async function PlannerPage() {
  const user = await requireUser();
  const selections = await webContainer().currentSelections({ userId: user.userId });
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Hola, {user.name}</h1>
      <PlannerSearch action={searchMenusAction} />
      <SelectionSummary selections={selections.ok ? selections.value : null} />
      <RandomMenuForm action={chooseRandomMenuAction} />
    </div>
  );
}
