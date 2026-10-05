import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PasswordField } from '@/features/auth/components/password-field';

describe('PasswordField', () => {
  it('hides the password by default', () => {
    render(<PasswordField label="Contraseña" name="password" />);

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows the password and hides it again', () => {
    render(<PasswordField label="Contraseña" name="password" />);

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }));

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Mostrar' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('never submits a form', () => {
    render(<PasswordField label="Contraseña" name="password" />);

    expect(screen.getByRole('button', { name: 'Mostrar' })).toHaveAttribute('type', 'button');
  });
});
