import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MenuPage from '@/app/(app)/menu/page';

const requireUser = vi.fn(async () => ({ userId: 'user-1', name: 'Ana' }));
vi.mock('@/app/_session/require-user', () => ({ requireUser: () => requireUser() }));

describe('MenuPage', () => {
  it('checks the session and shows its heading and a line about what will be there', async () => {
    render(await MenuPage());

    expect(requireUser).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByText(/menú de la semana/i)).toBeInTheDocument();
  });

  it("draws no main landmark of its own: the shell has the page's only one", async () => {
    render(await MenuPage());

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
