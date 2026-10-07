import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlannerPage from '@/app/(app)/planner/page';

const mocks = vi.hoisted(() => ({ currentSelections: vi.fn() }));

vi.mock('@/app/_session/require-user', () => ({
  requireUser: async () => ({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' }),
}));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ currentSelections: mocks.currentSelections }) }));
vi.mock('@/app/(app)/planner/actions', () => ({ chooseRandomMenuAction: vi.fn() }));

const NOTHING_CHOSEN = { ok: true, value: { activeMenu: null, shoppingList: null } };

afterEach(() => {
  vi.resetAllMocks();
});

describe('PlannerPage', () => {
  it('greets the user by name and has no sign-out control: the account menu of the shell has it', async () => {
    mocks.currentSelections.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage());

    expect(screen.getByRole('heading', { name: 'Hola, Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('draws no main landmark of its own: the shell has the page\'s only one', async () => {
    mocks.currentSelections.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage());

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('reads the session user\'s selections and shows them with the random-menu button', async () => {
    mocks.currentSelections.mockResolvedValue({
      ok: true,
      value: { activeMenu: { id: 'id-1', menuNumber: 3, startsOn: '2026-10-05' }, shoppingList: null },
    });
    render(await PlannerPage());

    expect(mocks.currentSelections).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(screen.getByText('Menú 3 · desde el lunes 5 de octubre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir un menú al azar' })).toBeInTheDocument();
  });

  it('says the menu could not be loaded and still offers the button when the selections fail', async () => {
    mocks.currentSelections.mockResolvedValue({ ok: false, error: { kind: 'failed' } });
    render(await PlannerPage());

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Elegir un menú al azar' })).toBeInTheDocument();
  });
});
