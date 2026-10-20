import { render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WeekNavigationDto } from '@/application/dto/week-navigation';
import type { WeeklyMenuDto } from '@/application/dto/weekly-menu';
import MenuPage from '@/app/(signed-in)/menu/page';

const mocks = vi.hoisted(() => ({ requireUser: vi.fn(), menuWeekPage: vi.fn() }));

vi.mock('@/app/_auth/require-user', () => ({ requireUser: mocks.requireUser }));
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

const NEXT_MONDAY = '2026-10-12';
const FUTURE: WeekNavigationDto = {
  shown: NEXT_MONDAY,
  current: THIS_MONDAY,
  previous: THIS_MONDAY,
  next: null,
  status: 'future',
  days: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'],
};
const LOCKED_BY_31 = { menuNumber: 31, startsOn: NEXT_MONDAY };

type Params = { startsOn?: string | string[] };

/** The page the way Next calls it: awaited props with the request's search params. */
async function pageElement(params: Params = {}) {
  const page = MenuPage as unknown as (props: { searchParams: Promise<Params> }) => ReturnType<typeof MenuPage>;
  return page({ searchParams: Promise.resolve(params) });
}

async function renderPage(params: Params = {}) {
  render(await pageElement(params));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('MenuPage', () => {
  it("shows the session user's menu of the week the use case gives", async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: MENU_3, lockedBy: null } });
    await renderPage();

    expect(mocks.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: undefined });
    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mié 7 hoy' })).toHaveAttribute('aria-current', 'true');
    expect(within(screen.getByRole('region', { name: 'Miércoles 7 de octubre' })).getByText('Lentejas estofadas')).toBeInTheDocument();
  });

  it('passes the raw startsOn to the use case, which validates it', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: null, lockedBy: null } });
    await renderPage({ startsOn: ['2026-09-28', '2026-10-05'] });

    expect(mocks.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: ['2026-09-28', '2026-10-05'] });
  });

  it('renders the week controls with the neighbouring weeks and the range', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: MENU_3, lockedBy: null } });
    await renderPage();

    expect(screen.getByRole('link', { name: 'Semana anterior' })).toHaveAttribute('href', '/menu?startsOn=2026-09-28');
    expect(screen.getByRole('link', { name: 'Semana siguiente' })).toHaveAttribute('href', '/menu?startsOn=2026-10-12');
    expect(screen.getByText('5 – 11 oct')).toBeInTheDocument();
  });

  it('says this week has no menu yet, and offers to search for one', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: null, lockedBy: null } });
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Semana sin menú' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Esta semana aún no tiene menú');
    expect(screen.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute(
      'href',
      '/planner?week=current',
    );
  });

  it('says no menu was chosen for a past week, and offers no search', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: PAST, menu: null, lockedBy: null } });
    await renderPage({ startsOn: PAST_MONDAY });

    expect(screen.getByRole('status')).toHaveTextContent('No se eligió menú para esta semana');
    expect(screen.queryByRole('link', { name: /Elegir menú/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Esta semana' })).toHaveAttribute('href', '/menu');
  });

  it('says this week is closed by the menu of next week, and links to it', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({
      ok: true,
      value: { navigation: CURRENT, menu: null, lockedBy: LOCKED_BY_31 },
    });
    await renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana no tiene menú');
    expect(screen.getByRole('status')).toHaveTextContent('Menú 31');
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-12',
    );
    expect(screen.queryByRole('link', { name: /Elegir menú/ })).not.toBeInTheDocument();
  });

  it('offers to choose next week when it has no menu, with the date of its Monday', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: FUTURE, menu: null, lockedBy: null } });
    await renderPage({ startsOn: NEXT_MONDAY });

    expect(screen.getByRole('status')).toHaveTextContent('La semana que viene aún no tiene menú');
    expect(screen.getByRole('link', { name: 'Elegir menú para el 12 oct' })).toHaveAttribute(
      'href',
      '/planner?week=next',
    );
    expect(screen.queryByRole('link', { name: 'Semana siguiente' })).not.toBeInTheDocument();
  });

  it('builds the links from the dates of the server, never from the request', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({
      ok: true,
      value: { navigation: CURRENT, menu: null, lockedBy: LOCKED_BY_31 },
    });
    await renderPage({ startsOn: '"><script>alert(1)</script>' });

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs.join(' ')).not.toContain('script');
  });

  it('says the menu could not be loaded, with no detail of the error', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: false, error: { kind: 'failed' } });
    await renderPage();

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('failed');
  });

  it('puts the menu, the empty week and the failure in the same centred box of the header', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    const boxes: (string | undefined)[] = [];
    for (const page of [
      { ok: true, value: { navigation: CURRENT, menu: MENU_3, lockedBy: null } },
      { ok: true, value: { navigation: CURRENT, menu: null, lockedBy: null } },
      { ok: false, error: { kind: 'failed' } },
    ]) {
      mocks.menuWeekPage.mockResolvedValue(page);
      const { container, unmount } = render(await pageElement());
      boxes.push(container.firstElementChild?.className);
      unmount();
    }

    expect(new Set(boxes).size).toBe(1);
    expect(boxes[0]).toContain('mx-auto');
    expect(boxes[0]).toContain('@min-[800px]:max-w-[1440px]');
  });

  it('reads nothing without a session: the redirect of requireUser ends it first', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(renderPage({ startsOn: PAST_MONDAY })).rejects.toThrow('NEXT_REDIRECT');
    expect(mocks.menuWeekPage).not.toHaveBeenCalled();
  });

  it('ignores parameters of the request naming another user or menu', async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: MENU_3, lockedBy: null } });
    await renderPage({ userId: 'user-2', menu: '12' } as Params);

    expect(mocks.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: undefined });
    expect(screen.getByRole('heading', { level: 1, name: 'Menú 3' })).toBeInTheDocument();
  });

  it("draws no main landmark of its own: the shell has the page's only one", async () => {
    mocks.requireUser.mockResolvedValue(ANA);
    mocks.menuWeekPage.mockResolvedValue({ ok: true, value: { navigation: CURRENT, menu: null, lockedBy: null } });
    await renderPage();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });
});
