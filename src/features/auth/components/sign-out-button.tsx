import { Button } from '@/features/auth/components/button';

type SignOutButtonProps = { action: () => Promise<void> };

/** Ends the session through the server action it receives. */
export function SignOutButton({ action }: SignOutButtonProps) {
  return (
    <form action={action}>
      <Button type="submit" variant="secondary">
        Cerrar sesión
      </Button>
    </form>
  );
}
