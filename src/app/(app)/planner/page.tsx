import { requireUser } from '@/app/_session/require-user';

/**
 * `/planner`: protected, inside the app shell (MF-51.1). A placeholder until MF-43 lists the menus. The sign-out
 * control is in the account menu of the shell (MF-51.2).
 */
export default async function PlannerPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Hola, {user.name}</h1>
      <p>Aquí podrás elegir el menú de la semana.</p>
    </div>
  );
}
