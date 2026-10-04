type SignOutButtonProps = { action: () => Promise<void> };

/** Ends the session through the server action it receives. */
export function SignOutButton({ action }: SignOutButtonProps) {
  return (
    <form action={action}>
      <button type="submit" className="rounded-full border px-4 py-2 font-semibold">
        Cerrar sesión
      </button>
    </form>
  );
}
