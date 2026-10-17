import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlannerPage from '@/app/(signed-in)/planner/page';

const mocks = vi.hoisted(() => ({ weeksToChoose: vi.fn() }));

vi.mock('@/app/_auth/require-user', () => ({
  requireUser: async () => ({ userId: 'user-1', name: 'Ana', email: 'ana@example.test' }),
}));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ weeksToChoose: mocks.weeksToChoose }) }));
vi.mock('@/app/(signed-in)/planner/actions', () => ({
  chooseMenuAction: vi.fn(),
  searchMenusAction: vi.fn(),
}));

const NOTHING_CHOSEN = {
  ok: true,
  value: {
    current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: null, locked: false },
    next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: null, locked: false },
    suggested: 'current',
  },
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('PlannerPage', () => {
  it('has no greeting and a heading only for screen readers, and no sign-out control: the account menu has it', async () => {
    mocks.weeksToChoose.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByText(/Hola/)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Buscar menú' })).toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
  });

  it('draws no main landmark of its own: the shell has the page\'s only one', async () => {
    mocks.weeksToChoose.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage({ searchParams: Promise.resolve({}) }));

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
  });

  it('reads the weeks of the session user and shows them in the selector, without the old summary', async () => {
    mocks.weeksToChoose.mockResolvedValue({
      ok: true,
      value: {
        ...NOTHING_CHOSEN.value,
        current: { ...NOTHING_CHOSEN.value.current, menuNumber: 3 },
        suggested: 'next',
      },
    });
    render(await PlannerPage({ searchParams: Promise.resolve({}) }));

    expect(mocks.weeksToChoose).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(screen.getByRole('radio', { name: /Esta semana/ })).toHaveAccessibleName(/Menú 3/);
    expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
    expect(screen.queryByText(/desde el lunes/)).not.toBeInTheDocument();
  });

  it.each([
    ['current', 'Esta semana'],
    ['next', 'La que viene'],
  ])('starts on the week of the query (%s) when it is open', async (week, name) => {
    mocks.weeksToChoose.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage({ searchParams: Promise.resolve({ week }) }));

    expect(screen.getByRole('radio', { name: new RegExp(name) })).toBeChecked();
  });

  it.each([['2026-10-19'], ['CURRENT'], [['next', 'current']]])('ignores a week of the query that is not current or next (%j)', async (week) => {
    mocks.weeksToChoose.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage({ searchParams: Promise.resolve({ week }) }));

    expect(screen.getByRole('radio', { name: /Esta semana/ })).toBeChecked();
  });

  it('says the menu could not be loaded and still offers the search and the random button when the weeks fail', async () => {
    mocks.weeksToChoose.mockResolvedValue({ ok: false, error: { kind: 'failed' } });
    render(await PlannerPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'request');
    expect(screen.getAllByRole('button', { name: 'Elegir uno al azar' })[0]).toBeInTheDocument();
  });

  it('renders the selector above the search, with the random button beside it', async () => {
    mocks.weeksToChoose.mockResolvedValue(NOTHING_CHOSEN);
    render(await PlannerPage({ searchParams: Promise.resolve({}) }));

    const box = screen.getByRole('textbox');
    const button = screen.getAllByRole('button', { name: 'Elegir uno al azar' })[0];
    expect(box).toHaveAttribute('name', 'request');
    expect(box.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Eligiendo menú para' }).compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has the padding of the design system: 20 px on a phone and 32 px from a 640 px container', async () => {
    mocks.weeksToChoose.mockResolvedValue(NOTHING_CHOSEN);
    const { container } = render(await PlannerPage({ searchParams: Promise.resolve({}) }));

    expect(container.firstElementChild).toHaveClass('py-5', '@min-[640px]:py-8');
    expect(container.firstElementChild).not.toHaveClass('py-8');
  });
});
