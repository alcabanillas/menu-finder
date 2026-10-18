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

  it('is oil yellow with ink text when warm', () => {
    render(<Button variant="warm">Acceder</Button>);

    expect(screen.getByRole('button', { name: 'Acceder' })).toHaveClass('bg-aceite-500', 'text-ink');
  });

  it('takes the full width when asked', () => {
    render(<Button fullWidth>Entrar</Button>);

    expect(screen.getByRole('button', { name: 'Entrar' })).toHaveClass('w-full');
  });

  it('is a borderless transparent button when ghost', () => {
    render(<Button variant="ghost">Ver semana</Button>);

    const button = screen.getByRole('button', { name: 'Ver semana' });
    expect(button).toHaveClass('border-transparent');
    expect(button).toHaveClass('bg-transparent');
  });

  it('is 36 px high with 14 px text when small', () => {
    render(<Button size="sm">Elegir</Button>);

    const button = screen.getByRole('button', { name: 'Elegir' });
    expect(button).toHaveClass('h-9');
    expect(button).toHaveClass('text-sm');
  });
});
