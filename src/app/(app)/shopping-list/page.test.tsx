import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShoppingListPage from '@/app/(app)/shopping-list/page';
import type { ShoppingChecklistDto } from '@/application/dto/shopping-checklist';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), shoppingChecklist: vi.fn() }));

vi.mock('@/app/_session/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ shoppingChecklist: mocks.shoppingChecklist }) }));
vi.mock('@/app/(app)/shopping-list/actions', () => ({ checkItemsAction: vi.fn() }));

const CHECKLIST: ShoppingChecklistDto = {
  menuNumber: 9101,
  startsOn: '2026-10-05',
  checkedCount: 1,
  total: 2,
  categories: [
    {
      name: 'Legumbres',
      checkedCount: 1,
      items: [
        { position: 1, name: 'Garbanzos cocidos', quantity: 400, unit: 'g', optional: false, checked: true },
        { position: 2, name: 'Piñones', quantity: 20, unit: 'g', optional: true, checked: false },
      ],
    },
  ],
};

async function open(search: Record<string, string | string[] | undefined> = {}) {
  render(await ShoppingListPage({ searchParams: Promise.resolve(search) }));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('ShoppingListPage', () => {
  it("checks the session first and reads the session user's list", async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: true, value: CHECKLIST });

    await open();

    expect(mocks.shoppingChecklist).toHaveBeenCalledExactlyOnceWith({ userId: 'user-1' });
    expect(screen.getByText('Menú 9101')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Garbanzos cocidos 400 g' })).toHaveAttribute('aria-checked', 'true');
  });

  it('reads nothing without a session: requireUser redirects first', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(open()).rejects.toThrow('NEXT_REDIRECT /login');
    expect(mocks.shoppingChecklist).not.toHaveBeenCalled();
  });

  it("draws no main landmark of its own: the shell has the page's only one", async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: true, value: CHECKLIST });

    await open();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('shows everything for an unknown view', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: true, value: CHECKLIST });

    await open({ vista: 'otra-cosa' });

    expect(screen.getByRole('checkbox', { name: /Garbanzos/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Todo' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows only what is left to buy for ?vista=por-comprar, with the progress unchanged', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: true, value: CHECKLIST });

    await open({ vista: 'por-comprar' });

    expect(screen.queryByRole('checkbox', { name: /Garbanzos/ })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Piñones/ })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', '1 de 2');
  });

  it('says no menu is chosen and links to the planner when there is no current list', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: true, value: null });

    await open();

    expect(screen.getByRole('heading', { level: 1, name: 'Lista de la compra' })).toBeInTheDocument();
    expect(screen.getByText('Aún no has elegido menú.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('says the list is not available when the menu has no stored items', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: true, value: { ...CHECKLIST, checkedCount: 0, total: 0, categories: [] } });

    await open();

    expect(screen.getByText('La lista de este menú no está disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('says the list could not be loaded when reading fails', async () => {
    mocks.requireUser.mockResolvedValue({ userId: 'user-1', name: 'Ana' });
    mocks.shoppingChecklist.mockResolvedValue({ ok: false, error: { kind: 'failed' } });

    await open();

    expect(screen.getByText('No se ha podido cargar la lista. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
