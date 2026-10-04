import { signOutAction } from '@/app/_session/actions';
import { requireUser } from '@/app/_session/require-user';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

/** `/planner`: protected. A placeholder until MF-43 lists the menus. */
export default async function PlannerPage() {
  const user = await requireUser();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-5">
      <h1 className="text-2xl font-extrabold">Hola, {user.name}</h1>
      <p>Aquí podrás elegir el menú de la semana.</p>
      <SignOutButton action={signOutAction} />
    </main>
  );
}
