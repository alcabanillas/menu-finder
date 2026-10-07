import { redirect } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInAction } from '@/app/_session/actions';
import { webContainer } from '@/composition/web-container';
import { err, ok } from '@/shared/result';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/composition/web-container', () => ({
  webContainer: vi.fn(),
}));

describe('signInAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to /planner on successful sign-in', async () => {
    const signInMock = vi.fn().mockResolvedValue(ok({ userId: 'u-1', name: 'Ana', email: 'ana@example.test' }));
    vi.mocked(webContainer).mockReturnValue({ signIn: signInMock } as unknown as ReturnType<typeof webContainer>);

    const form = new FormData();
    form.append('email', 'ana@example.test');
    form.append('password', 'secret-password');

    await signInAction({ message: null, attempt: 0 }, form);

    expect(redirect).toHaveBeenCalledWith('/planner');
  });

  it('returns rate-limited message when rate limit is exceeded', async () => {
    const signInMock = vi.fn().mockResolvedValue(err({ kind: 'rate-limited', resetAt: new Date() }));
    vi.mocked(webContainer).mockReturnValue({ signIn: signInMock } as unknown as ReturnType<typeof webContainer>);

    const form = new FormData();
    form.append('email', 'ana@example.test');
    form.append('password', 'wrong-pass');

    const result = await signInAction({ message: null, attempt: 2 }, form);

    expect(result).toEqual({
      message: 'Demasiados intentos. Espera unos minutos.',
      attempt: 3,
    });
  });

  it('returns wrong-credentials message on invalid credentials', async () => {
    const signInMock = vi.fn().mockResolvedValue(err({ kind: 'wrong-credentials' }));
    vi.mocked(webContainer).mockReturnValue({ signIn: signInMock } as unknown as ReturnType<typeof webContainer>);

    const form = new FormData();
    form.append('email', 'ana@example.test');
    form.append('password', 'wrong-pass');

    const result = await signInAction({ message: null, attempt: 0 }, form);

    expect(result).toEqual({
      message: 'El correo o la contraseña no coinciden.',
      attempt: 1,
    });
  });
});
