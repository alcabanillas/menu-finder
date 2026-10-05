import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from '@/features/auth/components/text-field';

describe('TextField', () => {
  it('is named by its label and receives the native props', () => {
    render(<TextField label="Correo electrónico" name="email" type="email" autoComplete="username" />);

    const input = screen.getByLabelText('Correo electrónico');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('autocomplete', 'username');
  });

  it('is valid and described by nothing without an error', () => {
    render(<TextField label="Contraseña" name="password" />);

    const input = screen.getByLabelText('Contraseña');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('is marked invalid and described by its error', () => {
    render(<TextField label="Correo electrónico" name="email" error="Escribe tu correo." />);

    const input = screen.getByLabelText('Correo electrónico');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Escribe tu correo.');
  });

  it('shows what it is given beside the input', () => {
    render(<TextField label="Contraseña" name="password" trailing={<button type="button">Mostrar</button>} />);

    expect(screen.getByRole('button', { name: 'Mostrar' })).toBeInTheDocument();
  });
});
