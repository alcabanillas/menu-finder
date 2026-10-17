import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActiveMenuCard } from '@/features/dashboard/components/active-menu-card';

describe('ActiveMenuCard', () => {
  it('names the menu of this week, its dates and the links to see it and to change it', () => {
    render(<ActiveMenuCard menu={{ kind: 'chosen', menuNumber: 12, firstDate: '2026-10-05', lastDate: '2026-10-11' }} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Menú 12' })).toBeInTheDocument();
    expect(screen.getByText('5 – 11 oct')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver la semana' })).toHaveAttribute('href', '/menu');
    expect(screen.getByRole('link', { name: 'Cambiar menú' })).toHaveAttribute('href', '/planner');
  });

  it('says there is no menu this week and links to choose one', () => {
    render(<ActiveMenuCard menu={{ kind: 'none' }} />);

    expect(screen.getByText('Aún no has elegido menú para esta semana.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
    expect(screen.queryByRole('link', { name: 'Ver la semana' })).not.toBeInTheDocument();
  });

  it('says the menu could not be loaded, with no detail and no links', () => {
    render(<ActiveMenuCard menu={{ kind: 'failed' }} />);

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toEqual([]);
  });
});
