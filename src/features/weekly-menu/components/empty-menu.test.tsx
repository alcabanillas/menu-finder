import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyMenu } from '@/features/weekly-menu/components/empty-menu';

const WEEK = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];

describe('EmptyMenu', () => {
  it('is titled "Semana sin menú", with the date of the week above it', () => {
    render(<EmptyMenu week={{ kind: 'open' }} days={WEEK} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Semana sin menú' })).toBeInTheDocument();
    expect(screen.getByText('Semana del 5 de octubre')).toBeInTheDocument();
  });

  it('shows one notice and no card for any day, Sunday included', () => {
    render(<EmptyMenu week={{ kind: 'open' }} days={WEEK} />);

    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByText('Lunes')).not.toBeInTheDocument();
    expect(screen.queryByText('Domingo')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-hidden="true"]:not(svg)')).toBeNull();
  });

  it('says this week has no menu yet, and offers to search for one', () => {
    render(<EmptyMenu week={{ kind: 'open' }} days={WEEK} />);

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana aún no tiene menú');
    expect(screen.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute(
      'href',
      '/planner?week=current',
    );
  });

  it('opens Buscar on next week from the empty next week, with the short date of its Monday', () => {
    render(<EmptyMenu week={{ kind: 'future', startsOn: '2026-10-12' }} days={WEEK} />);

    expect(screen.getByRole('status')).toHaveTextContent('La semana que viene aún no tiene menú');
    expect(screen.getByRole('link', { name: 'Elegir menú para el 12 oct' })).toHaveAttribute(
      'href',
      '/planner?week=next',
    );
  });

  it('says no menu was chosen for a past week, and offers no search', () => {
    render(<EmptyMenu week={{ kind: 'past' }} days={WEEK} />);

    expect(screen.getByText('No se eligió menú para esta semana')).toBeInTheDocument();
    expect(screen.getByText('Las semanas pasadas no se pueden cambiar.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the closed week and links to the menu of next week', () => {
    render(<EmptyMenu week={{ kind: 'locked', nextMenuNumber: 31, nextStartsOn: '2026-10-12' }} days={WEEK} />);

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana no tiene menú');
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-12',
    );
    expect(screen.queryByRole('link', { name: /Elegir/ })).not.toBeInTheDocument();
  });

  it('keeps the notice at most 760 px wide from 800 px, at the left', () => {
    render(<EmptyMenu week={{ kind: 'open' }} days={WEEK} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveClass('@min-[800px]:max-w-[760px]');
    expect(notice).not.toHaveClass('mx-auto');
  });

  it('says the menu could not be loaded, with no detail and no link', () => {
    render(<EmptyMenu week="failed" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
