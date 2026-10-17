import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingChecklistDto } from '@/application/dto/shopping-checklist';
import type { SignedInUser } from '@/application/dto/signed-in-user';
import type { DayDto, WeeklyMenuDto } from '@/application/dto/weekly-menu';
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

const NAVIGATION = { shown: '2026-10-05', current: '2026-10-05', status: 'current', days: DATES };
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
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Acceder' })).toHaveAttribute('href', '/login');
  });

  it('has no navigation, no account, no sign-in form, no version and reads no data', async () => {
    const { container: page } = render(await Home());

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cuenta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(page.textContent).not.toContain('9.8.7');
    expect(container.menuWeekPage).not.toHaveBeenCalled();
    expect(container.shoppingChecklist).not.toHaveBeenCalled();
  });
});

describe('Home with a session', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    container.currentUser.mockResolvedValue(ANA);
    container.menuWeekPage.mockResolvedValue(ok({ navigation: NAVIGATION, menu: MENU }));
    container.shoppingChecklist.mockResolvedValue(ok(LIST));
  });

  it('shows the dashboard inside the shell, with no redirect', async () => {
    render(await Home());

    expect(navigation.redirect).not.toHaveBeenCalled();
    expect(within(screen.getByRole('main')).getByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cuenta' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: 'Menú 12' })).toBeInTheDocument();
    expect(screen.getByText('Lentejas estofadas')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ítems marcados' })).toHaveAttribute('aria-valuetext', '5 de 40');
  });

  it('reads this week and the current list of the user of the session only', async () => {
    render(await Home());

    expect(container.menuWeekPage).toHaveBeenCalledWith({ userId: 'user-1', startsOn: undefined });
    expect(container.shoppingChecklist).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('says there is no menu this week and shows no dishes of today', async () => {
    container.menuWeekPage.mockResolvedValue(ok({ navigation: NAVIGATION, menu: null }));
    container.shoppingChecklist.mockResolvedValue(ok(null));

    render(await Home());

    expect(screen.getByText('Aún no has elegido menú para esta semana.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Qué toca hoy' })).not.toBeInTheDocument();
    expect(screen.getByText('Aún no tienes lista de la compra.')).toBeInTheDocument();
  });

  it('keeps the shopping block when the menu cannot be read', async () => {
    container.menuWeekPage.mockResolvedValue(err({ kind: 'failed' }));

    render(await Home());

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ítems marcados' })).toBeInTheDocument();
  });

  it('keeps the menu block when the list cannot be read', async () => {
    container.shoppingChecklist.mockResolvedValue(err({ kind: 'failed' }));

    render(await Home());

    expect(screen.getByText('No se ha podido cargar la lista. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Menú 12' })).toBeInTheDocument();
  });
});
