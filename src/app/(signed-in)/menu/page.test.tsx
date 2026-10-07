import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeeklyMenuDto } from '@/application/dto/weekly-menu';
import MenuPage from '@/app/(signed-in)/menu/page';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), activeMenu: vi.fn() }));

vi.mock('@/app/_session/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ activeMenu: mocks.activeMenu }) }));

const ANA = { userId: 'user-1', name: 'Ana', email: 'ana@example.test' };
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const MENU_3: WeeklyMenuDto = {
  menuNumber: 3,
  startsOn: '2026-10-05',
  today: '2026-10-07',
  days: DAYS.map((day, index) => ({
    day,
    date: `2026-10-${String(5 + index).padStart(2, '0')}`,
    meals: { lunch: [], dinner: [] },
  })),
};
MENU_3.days[2].meals.lunch = [{ name: 'Lentejas estofadas', recipe: null }];

afterEach(() => {
  vi.resetAllMocks();
});

describe('MenuPage', () => {
  it("shows the session user's active menu", async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.activeMenu.mockResolvedValue({ ok: true, value: MENU_3 });
    render(await MenuPage());

    expect(mocks.activeMenu).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getByText('Lentejas estofadas')).toBeInTheDocument();
  });

  it('says there is no menu for this week and links to the planner', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.activeMenu.mockResolvedValue({ ok: true, value: null });
    render(await MenuPage());

    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
  });

  it('says the menu could not be loaded, with no detail of the error', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.activeMenu.mockResolvedValue({ ok: false, error: { kind: 'failed' } });
    render(await MenuPage());

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('failed');
  });

  it('reads nothing without a session: the redirect of requireUser ends it first', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(MenuPage()).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.activeMenu).not.toHaveBeenCalled();
  });

  it('ignores parameters of the request naming another user or menu', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.activeMenu.mockResolvedValue({ ok: true, value: MENU_3 });
    const page = MenuPage as unknown as (props: object) => ReturnType<typeof MenuPage>;

    render(await page({ searchParams: Promise.resolve({ userId: 'user-2', menu: '12' }) }));

    expect(mocks.activeMenu).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
  });

  it("draws no main landmark of its own: the shell has the page's only one", async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.activeMenu.mockResolvedValue({ ok: true, value: null });
    render(await MenuPage());

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
