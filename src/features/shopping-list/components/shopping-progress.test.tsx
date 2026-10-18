import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShoppingProgress } from '@/features/shopping-list/components/shopping-progress';

describe('ShoppingProgress', () => {
  it('names the week of the list, shows the ticked items out of the total and links to the list', () => {
    render(<ShoppingProgress list={{ kind: 'list', startsOn: '2026-10-19', checkedCount: 5, total: 40 }} />);

    const title = screen.getByRole('heading', { level: 2, name: 'Compra · semana del 19 oct' });
    // The week never breaks across lines: if it does not fit, it moves whole to the next one.
    expect(title).not.toHaveClass('whitespace-nowrap');
    expect(screen.getByText('semana del 19 oct')).toHaveClass('whitespace-nowrap');
    expect(screen.getByRole('progressbar', { name: 'Comprado' })).toHaveAttribute('aria-valuetext', '5 de 40');
    expect(screen.getByRole('link', { name: 'Abrir' })).toHaveAttribute('href', '/shopping-list');
  });

  it('says the list appears when a menu is chosen, with no progress bar and no link', () => {
    render(<ShoppingProgress list={{ kind: 'none' }} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Compra' })).toBeInTheDocument();
    expect(screen.getByText('Aún no hay lista: aparece al elegir un menú.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Abrir' })).not.toBeInTheDocument();
  });

  it('says the list of the menu is not available instead of showing 0 of 0', () => {
    render(<ShoppingProgress list={{ kind: 'list', startsOn: '2026-10-19', checkedCount: 0, total: 0 }} />);

    expect(screen.getByText('La lista de este menú no está disponible.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('says the list could not be loaded', () => {
    render(<ShoppingProgress list={{ kind: 'failed' }} />);

    expect(screen.getByText('No se ha podido cargar la lista. Inténtalo de nuevo.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
