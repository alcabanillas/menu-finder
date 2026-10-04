import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import Home from '@/app/page';

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));
const container = vi.hoisted(() => ({ currentUser: vi.fn<() => Promise<SignedInUser | null>>() }));
vi.mock('next/navigation', () => navigation);
vi.mock('@/composition/web-container', () => ({ webContainer: () => container }));
vi.mock('@/app/_session/actions', () => ({ signInAction: vi.fn() }));

describe('Home', () => {
  it('shows the sign-in form without a session, with no sign-up or recovery', async () => {
    container.currentUser.mockResolvedValue(null);

    render(await Home());

    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });

  it('sends a signed-in user to /planner', async () => {
    container.currentUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });

    await expect(Home()).rejects.toThrow('redirect:/planner');
  });
});
