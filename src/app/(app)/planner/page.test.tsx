import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PlannerPage from '@/app/(app)/planner/page';

vi.mock('@/app/_session/require-user', () => ({
  requireUser: async () => ({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' }),
}));

describe('PlannerPage', () => {
  it('greets the user by name and has no sign-out control: the account menu of the shell has it', async () => {
    render(await PlannerPage());

    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('draws no main landmark of its own: the shell has the page\'s only one', async () => {
    render(await PlannerPage());

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
