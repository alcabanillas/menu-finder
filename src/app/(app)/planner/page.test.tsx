import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlannerPage from '@/app/(app)/planner/page';

vi.mock('@/app/_session/require-user', () => ({ requireUser: async () => ({ userId: 'user-1', name: 'Ana' }) }));
vi.mock('@/app/_session/actions', () => ({ signOutAction: vi.fn() }));

describe('PlannerPage', () => {
  it('greets the user by name and keeps the sign-out control until the account menu exists', async () => {
    render(await PlannerPage());

    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
  });

  it('draws no main landmark of its own: the shell has the page\'s only one', async () => {
    render(await PlannerPage());

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
