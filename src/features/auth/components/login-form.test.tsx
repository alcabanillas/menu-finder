import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm, type LoginFormState } from '@/features/auth/components/login-form';

type Action = (previous: LoginFormState, form: FormData) => Promise<LoginFormState>;

const WRONG_CREDENTIALS = 'El correo o la contraseña no coinciden.';

// Like the server action: every answer carries the next attempt number.
const answering = (message: string | null) =>
  vi.fn<Action>(async (previous) => ({ message, attempt: previous.attempt + 1 }));
const submit = () => fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
const fillIn = (email = 'ana@example.test', password = 'a-long-enough-pass') => {
  fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: password } });
};

describe('LoginForm', () => {
  it('renders an email field, a password field and a submit button', () => {
    render(<LoginForm action={answering(null)} />);

    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('sends what was typed to its action', async () => {
    const action = answering(null);
    render(<LoginForm action={action} />);

    fillIn();
    submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const formData = action.mock.calls[0][1];
    expect(formData.get('email')).toBe('ana@example.test');
    expect(formData.get('password')).toBe('a-long-enough-pass');
  });

  it('offers no sign-up and no password recovery', () => {
    render(<LoginForm action={answering(null)} />);

    expect(screen.queryAllByRole('link')).toEqual([]);
    expect(screen.queryByText(/registr|crear cuenta|olvid|recuperar/i)).toBeNull();
  });
});

describe('LoginForm: errors are announced every time', () => {
  it('shows the message its action returns', async () => {
    render(<LoginForm action={answering(WRONG_CREDENTIALS)} />);

    fillIn();
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent(WRONG_CREDENTIALS);
  });

  it('shows no message before the first answer', () => {
    render(<LoginForm action={answering(null)} />);

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('replaces the alert when the same message comes back', async () => {
    const action = answering(WRONG_CREDENTIALS);
    render(<LoginForm action={action} />);

    fillIn();
    submit();
    const first = await screen.findByRole('alert');
    fillIn();
    submit();
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));

    await waitFor(() => expect(screen.getByRole('alert')).not.toBe(first));
    expect(screen.getByRole('alert')).toHaveTextContent(WRONG_CREDENTIALS);
  });
});

describe('LoginForm: fields are checked before sending', () => {
  it('asks for both fields when they are empty, and sends nothing', async () => {
    const action = answering(null);
    render(<LoginForm action={action} />);

    submit();

    expect(await screen.findByText('Escribe tu correo.')).toBeInTheDocument();
    expect(screen.getByLabelText('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription('Escribe tu contraseña.');
    expect(action).not.toHaveBeenCalled();
  });

  it('asks to check an email without the shape of an address, and sends nothing', async () => {
    const action = answering(null);
    render(<LoginForm action={action} />);

    fillIn('ana@correo');
    submit();

    expect(await screen.findByText('Revisa el formato del correo.')).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it('sends valid fields with no field message', async () => {
    const action = answering(null);
    render(<LoginForm action={action} />);

    fillIn();
    submit();

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Escribe tu|Revisa el formato/)).toBeNull();
  });
});

describe('LoginForm: password and pending state', () => {
  it('shows the password without sending the form', () => {
    const action = answering(null);
    render(<LoginForm action={action} />);

    fillIn();
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }));

    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    expect(action).not.toHaveBeenCalled();
  });

  it('says it is signing in and cannot be sent again while the answer is pending', async () => {
    const pending = vi.fn<Action>(() => new Promise<LoginFormState>(() => {}));
    render(<LoginForm action={pending} />);

    fillIn();
    submit();

    const button = await screen.findByRole('button', { name: 'Entrando…' });
    expect(button).toBeDisabled();
  });
});
