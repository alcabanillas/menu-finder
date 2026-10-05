import { describe, expect, it } from 'vitest';
import { checkSignInFields } from '@/features/auth/sign-in-fields';

describe('checkSignInFields', () => {
  it('asks for both fields when they are empty', () => {
    expect(checkSignInFields('', '')).toEqual({ email: 'Escribe tu correo.', password: 'Escribe tu contraseña.' });
  });

  it('treats an email of spaces as empty', () => {
    expect(checkSignInFields('   ', 'secret').email).toBe('Escribe tu correo.');
  });

  it.each(['ana@correo', 'ana @x.es', 'ana.example.test', '@x.es', 'ana@x.', 'ana@.es'])('rejects %s, which is not shaped like an address', (email) => {
    expect(checkSignInFields(email, 'secret')).toEqual({ email: 'Revisa el formato del correo.', password: null });
  });

  it('accepts valid fields, with spaces around the email', () => {
    expect(checkSignInFields('  ana@example.test ', 'secret')).toEqual({ email: null, password: null });
  });

  it('does not trim the password', () => {
    expect(checkSignInFields('ana@example.test', ' ').password).toBeNull();
  });
});
