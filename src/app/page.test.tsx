import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import Home from '@/app/page';

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  usePathname: () => '/',
}));
const container = vi.hoisted(() => ({ currentUser: vi.fn<() => Promise<SignedInUser | null>>() }));
vi.mock('next/navigation', () => navigation);
vi.mock('@/composition/web-container', () => ({ webContainer: () => container }));
vi.mock('@/app/_session/actions', () => ({ signInAction: vi.fn(), signOutAction: vi.fn() }));

describe('Home', () => {
  it('shows the sign-in form without a session, with no sign-up or recovery and no shell', async () => {
    container.currentUser.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows a signed-in user the minimal page "Hoy" inside the shell, with no redirect', async () => {
    container.currentUser.mockResolvedValue({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' });

    render(await Home());

    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(within(screen.getByRole('main')).getByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'Principal' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('gives a signed-in user the account button, closed', async () => {
    container.currentUser.mockResolvedValue({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' });

    render(await Home());

    expect(screen.getByRole('button', { name: 'Cuenta' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows a visitor no account button', async () => {
    container.currentUser.mockResolvedValue(null);

    render(await Home());

    expect(screen.queryByRole('button', { name: 'Cuenta' })).not.toBeInTheDocument();
  });
});
