import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WelcomeScreen } from '@/features/welcome/components/welcome-screen';

describe('WelcomeScreen', () => {
  it('describes the product under a level-one heading', () => {
    render(<WelcomeScreen />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Planifica la semana sin darle vueltas' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Busca como hablas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Cada plato, con su receta' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'La compra, por categorías' })).toBeInTheDocument();
  });

  it('offers the way in as a link to the sign-in', () => {
    render(<WelcomeScreen />);

    expect(screen.getByRole('link', { name: 'Acceder' })).toHaveAttribute('href', '/login');
  });

  it('has no other link or control: no sign-up and no password recovery', () => {
    render(<WelcomeScreen />);

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryAllByRole('button')).toEqual([]);
    expect(screen.queryByText(/regístrate|crear cuenta|recuperar|olvidado/i)).not.toBeInTheDocument();
  });
});
