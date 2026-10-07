import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ShoppingListPage from '@/app/(app)/shopping-list/page';

const requireUser = vi.fn(async () => ({ userId: 'user-1', name: 'Ana' }));
vi.mock('@/app/_session/require-user', () => ({ requireUser: () => requireUser() }));

describe('ShoppingListPage', () => {
  it('checks the session and shows its heading and a line about what will be there', async () => {
    render(await ShoppingListPage());

    expect(requireUser).toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Compra' })).toBeInTheDocument();
    expect(screen.getByText(/lista de la compra/i)).toBeInTheDocument();
  });

  it("draws no main landmark of its own: the shell has the page's only one", async () => {
    render(await ShoppingListPage());

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
