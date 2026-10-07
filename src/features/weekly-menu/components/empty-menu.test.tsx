import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyMenu } from '@/features/weekly-menu/components/empty-menu';

describe('EmptyMenu', () => {
  it('says there is no menu for this week and links to the planner', () => {
    render(<EmptyMenu reason="none" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByText('Todavía no has elegido menú para esta semana.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir menú' })).toHaveAttribute('href', '/planner');
  });

  it('says the menu could not be loaded, with no detail and no link', () => {
    render(<EmptyMenu reason="failed" />);

    expect(screen.getByRole('heading', { level: 1, name: 'Menú' })).toBeInTheDocument();
    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
