import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm, type LoginFormState } from '@/features/auth/components/login-form';

type Action = (previous: LoginFormState, form: FormData) => Promise<LoginFormState>;

const answering = (state: LoginFormState) => vi.fn<Action>(async () => state);
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
// Both fields are required: an empty form is not submitted, as in a browser.
const fillIn = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'ana@example.test' } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'a-long-enough-pass' } });
};

describe('LoginForm', () => {
  it('renders an email field, a password field and a submit button', () => {
    render(<LoginForm action={answering({ message: null })} />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sends what was typed to its action', async () => {
    const action = answering({ message: null });
    render(<LoginForm action={action} />);

    fillIn();
    submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get('email')).toBe('ana@example.test');
    expect(formData.get('password')).toBe('a-long-enough-pass');
  });

  it('shows the message its action returns', async () => {
    render(<LoginForm action={answering({ message: 'El email o la contraseña no son correctos.' })} />);

    fillIn();
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('El email o la contraseña no son correctos.');
  });

  it('shows no message before the first answer', () => {
    render(<LoginForm action={answering({ message: null })} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('offers no sign-up and no password recovery', () => {
    render(<LoginForm action={answering({ message: null })} />);

    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryByText(/registr|crear cuenta|olvid|recuperar/i)).toBeNull();
  });
});
