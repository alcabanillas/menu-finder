import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoMenuNotice, type EmptyWeek } from '@/shared/ui/no-menu-notice';

const OPEN: EmptyWeek = { kind: 'open' };
const PAST: EmptyWeek = { kind: 'past' };
const LOCKED: EmptyWeek = { kind: 'locked', nextMenuNumber: 31, nextStartsOn: '2026-10-19' };
const FUTURE: EmptyWeek = { kind: 'future', startsOn: '2026-10-19' };

const notice = () => screen.getByRole('status');

describe('NoMenuNotice', () => {
  it('opens its text with an intro when it gets one, and keeps the rest', () => {
    render(<NoMenuNotice week={FUTURE} intro="Mañana empieza otra semana." />);

    expect(
      screen.getByText(
        'Mañana empieza otra semana. Elige uno en Buscar: escribe lo que os apetece y verás los menús que encajan.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú para el 19 oct' })).toHaveAttribute('href', '/planner?week=next');
  });

  it('offers to choose a menu for this week while it can still take one', () => {
    render(<NoMenuNotice week={OPEN} />);

    expect(notice()).toHaveTextContent('Esta semana aún no tiene menú');
    expect(screen.getByText(/Elige uno en Buscar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute(
      'href',
      '/planner?week=current',
    );
  });

  it("says this week is locked by next week's menu and links to that week", () => {
    render(<NoMenuNotice week={LOCKED} />);

    expect(notice()).toHaveTextContent('Esta semana no tiene menú');
    expect(screen.getByText(/\(Menú 31\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-19',
    );
    expect(screen.queryByRole('link', { name: /Elegir/ })).not.toBeInTheDocument();
  });

  it('says no menu was chosen for a past week, and offers nothing', () => {
    render(<NoMenuNotice week={PAST} />);

    expect(notice()).toHaveTextContent('No se eligió menú para esta semana');
    expect(screen.getByText('Las semanas pasadas no se pueden cambiar.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers to choose a menu for next week, with the short date of its Monday', () => {
    render(<NoMenuNotice week={FUTURE} />);

    expect(notice()).toHaveTextContent('La semana que viene aún no tiene menú');
    expect(screen.getByText(/Elige uno en Buscar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú para el 19 oct' })).toHaveAttribute(
      'href',
      '/planner?week=next',
    );
  });

  it('is olive when the week can take a menu and grey when it cannot', () => {
    const colours = [OPEN, FUTURE, PAST, LOCKED].map((week) => {
      const { unmount } = render(<NoMenuNotice week={week} />);
      const classes = notice().className;
      unmount();
      return [classes.includes('bg-olive-50'), classes.includes('bg-surface-hover')];
    });

    expect(colours).toEqual([
      [true, false],
      [true, false],
      [false, true],
      [false, true],
    ]);
  });

  it('is a status in every case', () => {
    for (const week of [OPEN, FUTURE, PAST, LOCKED]) {
      const { unmount } = render(<NoMenuNotice week={week} />);
      expect(screen.getAllByRole('status')).toHaveLength(1);
      unmount();
    }
  });

  it('takes the margin of the page that shows it, from a class name', () => {
    render(<NoMenuNotice week={OPEN} className="mb-9" />);

    expect(notice()).toHaveClass('mb-9');
  });

  it('takes its colour from the caller when it is given one, as Hoy does for a locked week', () => {
    render(<NoMenuNotice week={LOCKED} tone="olive" />);

    expect(notice()).toHaveClass('bg-olive-50');
    expect(notice()).not.toHaveClass('bg-surface-hover');
  });
});
