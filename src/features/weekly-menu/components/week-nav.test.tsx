import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WeekNavigationDto } from '@/application/dto/week-navigation';
import { WeekNav } from '@/features/weekly-menu/components/week-nav';

const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

const navigation = (overrides: Partial<WeekNavigationDto>): WeekNavigationDto => ({
  shown: '2026-10-05',
  current: '2026-10-05',
  previous: '2026-09-28',
  next: '2026-10-12',
  status: 'current',
  days: WEEK,
  ...overrides,
});

describe('WeekNav', () => {
  it('links to the previous and next weeks by their Monday, with the range between them', () => {
    render(<WeekNav {...navigation({})} />);

    expect(screen.getByRole('link', { name: 'Semana anterior' })).toHaveAttribute('href', '/menu?startsOn=2026-09-28');
    expect(screen.getByRole('link', { name: 'Semana siguiente' })).toHaveAttribute('href', '/menu?startsOn=2026-10-12');
    expect(screen.getByText('5 – 11 oct')).toBeInTheDocument();
  });

  it('disables the previous control at the window limit instead of removing it', () => {
    render(<WeekNav {...navigation({ shown: '2026-07-27', previous: null, next: '2026-08-03', status: 'past' })} />);

    expect(screen.getByText('Semana anterior').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: 'Semana anterior' })).not.toBeInTheDocument();
  });

  it('disables the next control beyond the next week', () => {
    render(<WeekNav {...navigation({ shown: '2026-10-12', previous: '2026-10-05', next: null, status: 'future' })} />);

    expect(screen.getByText('Semana siguiente').closest('[aria-disabled]')).toHaveAttribute('aria-disabled', 'true');
  });

  it('offers a return to this week only when another week is shown', () => {
    const { unmount } = render(<WeekNav {...navigation({})} />);
    expect(screen.queryByRole('link', { name: 'Esta semana' })).not.toBeInTheDocument();
    unmount();

    render(
      <WeekNav {...navigation({ shown: '2026-09-28', previous: '2026-09-21', next: '2026-10-05', status: 'past' })} />,
    );
    expect(screen.getByRole('link', { name: 'Esta semana' })).toHaveAttribute('href', '/menu');
  });
});
