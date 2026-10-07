import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/shared/ui/button';

describe('Button', () => {
  it('renders its label as a plain button by default', () => {
    render(<Button>Entrar</Button>);

    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveAttribute('type', 'button');
  });

  it('passes the native type and disabled state', () => {
    render(
      <Button type="submit" disabled>
        Entrar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Entrar' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
  });

  it('is olive when primary and ink-outlined when secondary', () => {
    render(
      <>
        <Button>Entrar</Button>
        <Button variant="secondary">Cerrar sesión</Button>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('bg-olive-600');
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toHaveClass('border-border-ink');
  });

  it('takes the full width when asked', () => {
    render(<Button fullWidth>Entrar</Button>);

    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('w-full');
  });
});
