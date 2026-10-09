import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeekNavigationDto } from '@/application/dto/week-navigation';
import type { WeeklyMenuDto } from '@/application/dto/weekly-menu';
import MenuPage from '@/app/(signed-in)/menu/page';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), menuWeekPage: vi.fn() }));

vi.mock('@/app/_session/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ menuWeekPage: mocks.menuWeekPage }) }));

const ANA = { userId: 'user-1', name: 'Ana', email: 'ana@example.test' };
const THIS_MONDAY = '2026-10-05';
const PAST_MONDAY = '2026-09-28';
const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const MENU_3: WeeklyMenuDto = {
  menuNumber: 3,
  startsOn: THIS_MONDAY,
  today: '2026-10-07',
  days: DAYS.map((day, index) => ({
    day,
    date: WEEK[index],
    meals: { lunch: [], dinner: [] },
  })),
};
MENU_3.days[2].meals.lunch = [{ name: 'Lentejas estofadas', recipe: null }];

const CURRENT: WeekNavigationDto = {
  shown: THIS_MONDAY,
  current: THIS_MONDAY,
  previous: PAST_MONDAY,
  next: '2026-10-12',
  status: 'current',
  days: WEEK,
};
const PAST: WeekNavigationDto = {
  shown: PAST_MONDAY,
  current: THIS_MONDAY,
  previous: '2026-09-21',
  next: THIS_MONDAY,
  status: 'past',
  days: ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
};

type Params = { startsOn?: string | string[] };

/** Renders the page the way Next does: awaited props with the request's search params. */
async function renderPage(params: Params = {}) {
  const page = MenuPage as unknown as (props: { searchParams: Promise<Params> }) => ReturnType<typeof MenuPage>;
  render(await page({ searchParams: Promise.resolve(params) }));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('MenuPage', () => {
  it("shows the session user's menu of the week the use case gives", async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: MENU_3 } });
    await renderPage();

    expect(mocks.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: undefined });
    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
    expect(within(screen.getByRole('tabpanel')).getByText('Lentejas estofadas')).toBeInTheDocument();
  });

  it('passes the raw startsOn to the use case, which validates it', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: null } });
    await renderPage({ startsOn: ['2026-09-28', '2026-10-05'] });

    expect(mocks.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: ['2026-09-28', '2026-10-05'] });
  });

  it('renders the week controls with the neighbouring weeks and the range', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: MENU_3 } });
    await renderPage();

    expect(screen.getByRole('link', { name: 'Semana anterior' })).toHaveAttribute('href', '/menu?startsOn=2026-09-28');
    expect(screen.getByRole('link', { name: 'Semana siguiente' })).toHaveAttribute('href', '/menu?startsOn=2026-10-12');
    expect(screen.getByText('5 – 11 oct')).toBeInTheDocument();
  });

  it('says this week has no menu yet, and offers to search for one', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: null } });
    await renderPage();

    expect(screen.getByText('Todavía no has elegido menú para esta semana.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
  });

  it('says no menu was chosen for a past week, and offers no search', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: PAST, menu: null } });
    await renderPage({ startsOn: PAST_MONDAY });

    expect(screen.getByText('No se eligió menú para esta semana.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Elegir menú' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Esta semana' })).toHaveAttribute('href', '/menu');
  });

  it('says the menu could not be loaded, with no detail of the error', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: false, error: { kind: 'failed' } });
    await renderPage();

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('failed');
  });

  it('reads nothing without a session: the redirect of requireUser ends it first', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(renderPage({ startsOn: PAST_MONDAY })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.menuWeekPage).not.toHaveBeenCalled();
  });

  it('ignores parameters of the request naming another user or menu', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: MENU_3 } });
    await renderPage({ userId: 'user-2', menu: '12' } as Params);

    expect(mocks.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: undefined });
    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
  });

  it("draws no main landmark of its own: the shell has the page's only one", async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: null } });
    await renderPage();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
