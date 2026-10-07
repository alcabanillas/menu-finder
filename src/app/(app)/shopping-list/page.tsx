import { requireUser } from '@/app/_session/require-user';

/** `/shopping-list`: protected, inside the app shell (MF-51.1). A placeholder until MF-24 shows the shopping list. */
export default async function ShoppingListPage() {
  await requireUser();
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Compra</h1>
      <p>Aquí verás la lista de la compra.</p>
    </div>
  );
}
