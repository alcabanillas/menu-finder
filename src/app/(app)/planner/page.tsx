import { signOutAction } from '@/app/_session/actions';
import { requireUser } from '@/app/_session/require-user';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

/**
 * `/planner`: protected, inside the app shell (MF-51.1). A placeholder until MF-43 lists the menus; it keeps its own
 * sign-out button until MF-51.2 puts it in the account menu.
 */
export default async function PlannerPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-5 py-16">
      <h1 className="text-2xl font-extrabold">Hola, {user.name}</h1>
      <p>Aquí podrás elegir el menú de la semana.</p>
      <SignOutButton action={signOutAction} />
    </div>
  );
}
