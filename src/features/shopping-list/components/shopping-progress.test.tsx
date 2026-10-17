import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShoppingProgress } from '@/features/shopping-list/components/shopping-progress';

describe('ShoppingProgress', () => {
  it('shows the ticked items out of the total and links to the list', () => {
    render(<ShoppingProgress list={{ kind: 'list', checkedCount: 5, total: 40 }} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Lista de la semana' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Ítems marcados' })).toHaveAttribute('aria-valuetext', '5 de 40');
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/shopping-list');
  });

  it('says there is no list yet, with no progress bar', () => {
    render(<ShoppingProgress list={{ kind: 'none' }} />);

    expect(screen.getByText('Aún no tienes lista de la compra.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says the list of the menu is not available instead of showing 0 of 0', () => {
    render(<ShoppingProgress list={{ kind: 'list', checkedCount: 0, total: 0 }} />);

    expect(screen.getByText('La lista de este menú no está disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says the list could not be loaded', () => {
    render(<ShoppingProgress list={{ kind: 'failed' }} />);

    expect(screen.getByText('No se ha podido cargar la lista. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
