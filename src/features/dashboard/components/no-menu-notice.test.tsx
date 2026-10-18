import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoMenuNotice } from '@/features/dashboard/components/no-menu-notice';

describe('NoMenuNotice', () => {
  it('offers to choose a menu for this week while it can still take one', () => {
    render(<NoMenuNotice week={{ kind: 'open' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana aún no tiene menú');
    expect(screen.getByText(/Elige uno en Buscar/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú para esta semana' })).toHaveAttribute(
      'href',
      '/planner?week=current',
    );
  });

  it("says this week is locked by next week's menu and links to that week", () => {
    render(<NoMenuNotice week={{ kind: 'locked', nextMenuNumber: 31, nextStartsOn: '2026-10-19' }} />);

    expect(screen.getByRole('status')).toHaveTextContent('Esta semana no tiene menú');
    expect(screen.getByText(/\(Menú 31\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el menú de la semana que viene' })).toHaveAttribute(
      'href',
      '/menu?startsOn=2026-10-19',
    );
    expect(screen.queryByRole('link', { name: /Elegir/ })).not.toBeInTheDocument();
  });
});
