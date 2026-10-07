import { checkItemsAction } from '@/app/(app)/shopping-list/actions';
import { requireUser } from '@/app/_session/require-user';
import { webContainer } from '@/composition/web-container';
import { ChecklistMessage } from '@/features/shopping-list/components/checklist-message';
import { ShoppingChecklist } from '@/features/shopping-list/components/shopping-checklist';

type ShoppingListPageProps = { searchParams: Promise<{ vista?: string | string[] }> };

/**
 * `/shopping-list`: protected, inside the app shell. The current selection's shopping list as a checklist (MF-24);
 * `?vista=por-comprar` hides what is ticked, any other value shows everything.
 */
export default async function ShoppingListPage({ searchParams }: ShoppingListPageProps) {
  const user = await requireUser();
  const { vista } = await searchParams;
  const result = await webContainer().shoppingChecklist({ userId: user.userId });
  if (!result.ok) return <ChecklistMessage text="No se ha podido cargar la lista. Inténtalo de nuevo." />;
  if (!result.value) return <ChecklistMessage text="Aún no has elegido menú." link={{ href: '/planner', label: 'Elegir menú' }} />;
  if (result.value.total === 0) return <ChecklistMessage text="La lista de este menú no está disponible." />;
  return <ShoppingChecklist checklist={result.value} view={vista === 'por-comprar' ? 'pending' : 'all'} action={checkItemsAction} />;
}
