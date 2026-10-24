import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingChecklistDto } from '@/application/dto/shopping-checklist';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { TodaysMenuDto } from '@/application/dto/todays-menu';
import type { DayDto, WeekDayDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
import Home from '@/app/page';
import { err, ok } from '@/shared/result';

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  usePathname: () => '/',
}));
const container = vi.hoisted(() => ({
  currentUser: vi.fn<() => Promise<SignedInUser | null>>(),
  menuWeekPage: vi.fn(),
  todaysMenu: vi.fn(),
  weeksToChoose: vi.fn(),
  shoppingChecklist: vi.fn(),
}));
vi.mock('next/navigation', () => navigation);
vi.mock('@/composition/web-container', () => ({ webContainer: () => container }));
vi.mock('@/app/_auth/actions', () => ({ signInAction: vi.fn(), signOutAction: vi.fn() }));
vi.mock('@/app/app-version', () => ({ APP_VERSION: '9.8.7' }));

const ANA: SignedInUser = { userId: 'user-1', name: 'Ana', email: 'ana@example.test' };
const DAYS: DayDto[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DATES = DAYS.map((_, index) => `2026-10-${String(5 + index).padStart(2, '0')}`);

const MENU: WeeklyMenuDto = {
  menuNumber: 12,
  startsOn: '2026-10-05',
  today: '2026-10-07',
  days: DAYS.map((day, index) => ({ day, date: DATES[index], meals: { lunch: [], dinner: [] } })),
};
MENU.days[2].meals = { lunch: [{ name: 'Lentejas estofadas', recipe: null }], dinner: [{ name: 'Sepia', recipe: null }] };

const TODAY_MENU = (tomorrow: TodaysMenuDto['tomorrow'] = { kind: 'none' }) =>
  ok({ today: '2026-10-07', day: MENU.days[2], tomorrow } satisfies TodaysMenuDto);
const NO_MENU_THIS_WEEK = ok({ today: '2026-10-07', day: null, tomorrow: { kind: 'none' } } satisfies TodaysMenuDto);
const SUNDAY_MENU = (tomorrow: TodaysMenuDto['tomorrow']) =>
  ok({ today: '2026-10-11', day: MENU.days[6], tomorrow } satisfies TodaysMenuDto);
const NEXT_MONDAY_DAY: WeekDayDto = {
  day: 'monday',
  date: '2026-10-12',
  meals: { lunch: [{ name: 'Pisto con huevo', recipe: null }], dinner: [] },
};
const WEEKS = (thisWeek: number | null, nextWeek: number | null): WeeksToChooseDto => ({
  current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: thisWeek, locked: nextWeek !== null },
  next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: nextWeek, locked: false },
  suggested: 'next',
});
const LIST = { menuNumber: 12, startsOn: '2026-10-05', checkedCount: 5, total: 40, categories: [] } as ShoppingChecklistDto;

describe('Home without a session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container.currentUser.mockResolvedValue(null);
  });

  it('shows the informative home inside the shell for a visitor, with the way in', async () => {
    render(await Home());

    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Acceder' })).toHaveAttribute('href', '/login');
    const links = within(screen.getByRole('main')).getAllByRole('link', { name: 'Acceder' });
    expect(links).toHaveLength(2);
    links.forEach((link) => expect(link).toHaveAttribute('href', '/login'));
  });

  it('shows the sample search: the request, its three chips and the card of Menú 14 with its evidence', async () => {
    const { container: page } = render(await Home());

    const [search] = page.querySelectorAll('[data-sample]');
    expect(search).toHaveTextContent('de cuchara, sin cerdo y con garbanzos');
    expect([...search.querySelectorAll('li [data-member]')].map((chip) => chip.textContent)).toEqual([
      'de cuchara',
      'cerdo',
      'garbanzos',
    ]);
    expect(within(search as HTMLElement).getByRole('heading', { level: 3, hidden: true, name: 'Menú 14' })).toBeInTheDocument();
    expect(search).toHaveTextContent('Cumple las 3 cosas que pides.');
    expect(search).toHaveTextContent('✓cerdono aparece en la semana');
  });

  it('shows the sample pieces of the three features: six days, an open recipe and a category with three items', async () => {
    const { container: page } = render(await Home());

    const [, week, recipe, shopping] = page.querySelectorAll('[data-sample]');
    expect(week.querySelectorAll('[data-glance-day]')).toHaveLength(6);
    expect(within(recipe as HTMLElement).getByRole('button', { hidden: true })).toHaveAttribute('aria-expanded', 'true');
    expect(within(recipe as HTMLElement).getByRole('list', { hidden: true, name: 'Preparación' })).toBeInTheDocument();
    expect(shopping.querySelectorAll('[data-sample-item]')).toHaveLength(3);
  });

  it('has no navigation, no account, no sign-in form, no version and reads no data', async () => {
    const { container: page } = render(await Home());

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(page.textContent).not.toContain('9.8.7');
    expect(container.menuWeekPage).not.toHaveBeenCalled();
    expect(container.weeksToChoose).not.toHaveBeenCalled();
    expect(container.shoppingChecklist).not.toHaveBeenCalled();
  });
});

describe('Home with a session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container.currentUser.mockResolvedValue(ANA);
    container.todaysMenu.mockResolvedValue(TODAY_MENU());
    container.weeksToChoose.mockResolvedValue(ok(WEEKS(12, null)));
    container.shoppingChecklist.mockResolvedValue(ok(LIST));
  });

  it('shows the dashboard inside the shell, with no redirect', async () => {
    render(await Home());

    expect(navigation.redirect).not.toHaveBeenCalled();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('heading', { level: 1, name: 'Qué toca hoy' })).toBeInTheDocument();
    expect(within(main).getByText('Miércoles 7 de octubre')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cuenta' })).toHaveAttribute('aria-expanded', 'false');
    expect(within(screen.getByRole('region', { name: 'Semanas' })).getByText('Menú 12')).toBeInTheDocument();
    expect(screen.getAllByText('Lentejas estofadas')).not.toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Ver menú' })).toHaveAttribute('href', '/menu');
    expect(screen.getByRole('heading', { name: 'Compra · semana del 5 oct' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Comprado' })).toHaveAttribute('aria-valuetext', '5 de 40');
  });

  it('reads this week, the two weeks and the current list of the user of the session only', async () => {
    render(await Home());

    expect(container.todaysMenu).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(container.menuWeekPage).not.toHaveBeenCalled();
    expect(container.weeksToChoose).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(container.shoppingChecklist).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('offers to choose a menu for this week when it has none and can still take one', async () => {
    container.todaysMenu.mockResolvedValue(NO_MENU_THIS_WEEK);
    container.weeksToChoose.mockResolvedValue(ok(WEEKS(null, null)));
    container.shoppingChecklist.mockResolvedValue(ok(null));

    render(await Home());

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana aún no tiene menú');
    expect(screen.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute('href', '/planner?week=current');
    expect(screen.getByText('Miércoles 7 de octubre')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver menú' })).not.toBeInTheDocument();
    expect(screen.getByText('Aún no hay lista: aparece al elegir un menú.')).toBeInTheDocument();
  });

  it("says this week is locked by next week's menu and links to next week", async () => {
    container.todaysMenu.mockResolvedValue(NO_MENU_THIS_WEEK);
    container.weeksToChoose.mockResolvedValue(ok(WEEKS(null, 31)));

    render(await Home());

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana no tiene menú');
    expect(screen.getByRole('status')).toHaveClass('bg-olive-50');
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-12',
    );
    expect(screen.queryByRole('link', { name: 'Elegir menú para esta semana' })).not.toBeInTheDocument();
  });

  it('keeps the weeks and the shopping when the menu cannot be read', async () => {
    container.todaysMenu.mockResolvedValue(err({ kind: 'failed' }));

    render(await Home());

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Semanas' })).getByText('Menú 12')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Comprado' })).toBeInTheDocument();
  });

  it("keeps today's dishes and the shopping when the weeks cannot be read", async () => {
    container.weeksToChoose.mockResolvedValue(err({ kind: 'failed' }));

    render(await Home());

    expect(within(screen.getByRole('region', { name: 'Semanas' })).getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.getAllByText('Lentejas estofadas')).not.toHaveLength(0);
    expect(screen.getByRole('progressbar', { name: 'Comprado' })).toBeInTheDocument();
  });

  it('shows no notice when this week has no menu and the weeks cannot be read', async () => {
    container.todaysMenu.mockResolvedValue(NO_MENU_THIS_WEEK);
    container.weeksToChoose.mockResolvedValue(err({ kind: 'failed' }));

    render(await Home());

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByText('No se ha podido cargar tu menú.')).toHaveLength(2);
  });

  it('keeps the weeks when the list cannot be read', async () => {
    container.shoppingChecklist.mockResolvedValue(err({ kind: 'failed' }));

    render(await Home());

    expect(screen.getByText('No se ha podido cargar la lista. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Semanas' })).getByText('Menú 12')).toBeInTheDocument();
  });
});

describe('Home with a session, on a Sunday', () => {
  const home = Home as unknown as (props: object) => ReturnType<typeof Home>;

  beforeEach(() => {
    vi.clearAllMocks();
    container.currentUser.mockResolvedValue(ANA);
    container.weeksToChoose.mockResolvedValue(ok(WEEKS(12, null)));
    container.shoppingChecklist.mockResolvedValue(ok(LIST));
  });

  it('shows the rest day, and next Monday with its menu when next week is chosen', async () => {
    container.todaysMenu.mockResolvedValue(
      SUNDAY_MENU({ kind: 'next-week', day: NEXT_MONDAY_DAY, menuNumber: 31, startsOn: '2026-10-12' }),
    );

    render(await Home());

    expect(screen.getByText('Domingo 11 de octubre')).toBeInTheDocument();
    expect(screen.getByText('Domingo libre')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ver menú' })).not.toBeInTheDocument();
    expect(screen.getByText('Mañana · Lunes 12 · Menú 31')).toBeInTheDocument();
    expect(screen.getByText('Pisto con huevo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-12',
    );
  });

  it('offers to choose next week when it has no menu', async () => {
    container.todaysMenu.mockResolvedValue(SUNDAY_MENU({ kind: 'no-menu', startsOn: '2026-10-12' }));

    render(await Home());

    expect(screen.getByText('Domingo libre')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('La semana que viene aún no tiene menú');
    expect(screen.getByRole('link', { name: 'Elegir menú para el 12 oct' })).toHaveAttribute('href', '/planner?week=next');
  });

  it('does not change whose next week is shown with a parameter of the request', async () => {
    container.todaysMenu.mockResolvedValue(SUNDAY_MENU({ kind: 'no-menu', startsOn: '2026-10-12' }));

    render(await home({ searchParams: Promise.resolve({ userId: 'user-2' }) }));

    expect(container.todaysMenu).toHaveBeenCalledTimes(1);
    expect(container.todaysMenu).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(screen.getByRole('status')).toHaveTextContent('La semana que viene aún no tiene menú');
  });

  it("shows no tomorrow, and keeps today, the weeks and the shopping, when next week's menu cannot be read", async () => {
    container.todaysMenu.mockResolvedValue(SUNDAY_MENU({ kind: 'none' }));

    render(await Home());

    expect(screen.getByText('Domingo libre')).toBeInTheDocument();
    expect(screen.queryByText(/^Mañana/)).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Semanas' })).getByText('Menú 12')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Comprado' })).toBeInTheDocument();
    expect(screen.queryByText(/failed|down/i)).not.toBeInTheDocument();
  });
});
