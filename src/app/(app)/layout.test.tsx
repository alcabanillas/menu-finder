import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import AppLayout from '@/app/(app)/layout';

const session = vi.hoisted(() => ({ sessionUser: vi.fn<() => Promise<SignedInUser | null>>() }));
vi.mock('@/app/_session/session-user', () => session);
vi.mock('@/app/_session/actions', () => ({ signOutAction: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('the layout must not redirect');
  }),
  usePathname: () => '/planner',
}));

describe('AppLayout', () => {
  beforeEach(() => session.sessionUser.mockReset());

  it('puts the page inside the shell, with the account button for the user of the session', async () => {
    session.sessionUser.mockResolvedValue({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' });

    render(await AppLayout({ children: <h1>Página</h1> }));

    expect(screen.getByRole('main')).toHaveTextContent('Página');
    expect(screen.getByRole('button', { name: 'Cuenta' })).toBeInTheDocument();
  });

  // The layout is not the access check (design D1): without a session it shows no account and does not redirect; the
  // page's own `requireUser()` does.
  it('shows no account button and does not redirect when there is no session', async () => {
    session.sessionUser.mockResolvedValue(null);

    render(await AppLayout({ children: <h1>Página</h1> }));

    expect(screen.queryByRole('button', { name: 'Cuenta' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Página');
  });
});
