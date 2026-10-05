import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormAlert } from '@/features/auth/components/form-alert';

describe('FormAlert', () => {
  it('shows its message as an alert', () => {
    render(<FormAlert message="El correo o la contraseña no coinciden." />);

    expect(screen.getByRole('alert')).toHaveTextContent('El correo o la contraseña no coinciden.');
  });
});
