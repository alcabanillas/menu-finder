import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignOutButton } from '@/features/auth/components/sign-out-button';

describe('SignOutButton', () => {
  it('runs its action when pressed', async () => {
    const action = vi.fn(async () => {});
    render(<SignOutButton action={action} />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
