import { requireUser } from '@/app/_session/require-user';

/** `/menu`: protected, inside the app shell (MF-51.1). A placeholder until MF-23 shows the week's menu. */
export default async function MenuPage() {
  await requireUser();
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Menú</h1>
      <p>Aquí verás el menú de la semana.</p>
    </div>
  );
}
