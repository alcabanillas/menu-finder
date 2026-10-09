import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyMenu } from '@/features/weekly-menu/components/empty-menu';

const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

describe('EmptyMenu', () => {
  it('says this week has no menu yet, and offers to search for one', () => {
    render(<EmptyMenu status="current" days={WEEK} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no has elegido menú para esta semana.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
  });

  it('says no menu was chosen for a past week, and offers no search', () => {
    render(<EmptyMenu status="past" days={WEEK} />);

    expect(screen.getByText('No se eligió menú para esta semana.')).toBeInTheDocument();
    expect(screen.getByText('Las semanas pasadas no se pueden cambiar.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the seven days of the week as placeholders, with their dates', () => {
    render(<EmptyMenu status="future" days={WEEK} />);

    const ghosts = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(within(ghosts).getByText('Lunes')).toBeInTheDocument();
    expect(within(ghosts).getByText('Domingo')).toBeInTheDocument();
    expect(within(ghosts).getByText('11 de octubre')).toBeInTheDocument();
  });

  it('says the menu could not be loaded, with no detail and no link', () => {
    render(<EmptyMenu status="failed" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
