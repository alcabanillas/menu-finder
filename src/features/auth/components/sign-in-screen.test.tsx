import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LoginFormState } from '@/features/auth/components/login-form';
import { SignInScreen } from '@/features/auth/components/sign-in-screen';

type Action = (previous: LoginFormState, form: FormData) => Promise<LoginFormState>;

const answering = () => vi.fn<Action>(async (previous) => ({ message: null, attempt: previous.attempt + 1 }));

describe('SignInScreen', () => {
  it('shows the heading of the sign-in screen and the product panel', () => {
    render(<SignInScreen action={answering()} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Accede a tu menú' })).toBeInTheDocument();
    expect(screen.getByRole('complementary')).toHaveTextContent('Menu Finder');
  });

  it('sends the form through the action it receives', async () => {
    const action = answering();
    render(<SignInScreen action={action} />);

    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.test' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a-long-enough-pass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  });
});
