import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import { WeeksCard } from '@/features/dashboard/components/weeks-card';

const weeks = (thisWeekMenu: number | null, nextWeekMenu: number | null): WeeksToChooseDto => ({
  current: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: thisWeekMenu, locked: nextWeekMenu !== null },
  next: { startsOn: '2026-10-19', endsOn: '2026-10-25', menuNumber: nextWeekMenu, locked: false },
  suggested: 'next',
});

describe('WeeksCard', () => {
  it('shows both weeks with their dates and menus, and no way to choose', () => {
    render(<WeeksCard weeks={{ kind: 'read', weeks: weeks(26, 31) }} />);
    const card = screen.getByRole('region', { name: 'Semanas' });

    expect(within(card).getByText('Esta semana · 12 – 18 oct')).toBeInTheDocument();
    expect(within(card).getByText('Menú 26')).toBeInTheDocument();
    expect(within(card).getByText('La semana que viene · 19 – 25 oct')).toBeInTheDocument();
    expect(within(card).getByText('Menú 31')).toBeInTheDocument();
    expect(within(card).queryByRole('link')).not.toBeInTheDocument();
  });

  it('offers to choose next week when it has no menu', () => {
    render(<WeeksCard weeks={{ kind: 'read', weeks: weeks(26, null) }} />);

    expect(screen.getByText('La semana que viene')).toBeInTheDocument();
    expect(screen.getByText('Sin elegir')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir' })).toHaveAttribute('href', '/planner?week=next');
  });

  it('says this week has no menu, and is shown only from 800 px', () => {
    render(<WeeksCard weeks={{ kind: 'read', weeks: weeks(null, null) }} />);
    const card = screen.getByRole('region', { name: 'Semanas' });

    expect(within(card).getByText('Sin menú')).toBeInTheDocument();
    expect(within(card).queryByText(/^Menú \d/)).not.toBeInTheDocument();
    expect(card).toHaveClass('hidden', '@min-[800px]:block');
  });

  it('is shown on a phone when this week has a menu', () => {
    render(<WeeksCard weeks={{ kind: 'read', weeks: weeks(26, null) }} />);

    expect(screen.getByRole('region', { name: 'Semanas' })).not.toHaveClass('hidden');
  });

  it('says the weeks could not be loaded, with no detail and no links', () => {
    render(<WeeksCard weeks={{ kind: 'failed' }} />);

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});
