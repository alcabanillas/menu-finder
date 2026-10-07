import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseRandomMenuAction } from '@/app/(app)/planner/actions';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  selectRandomMenu: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/_session/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ selectRandomMenu: mocks.selectRandomMenu }) }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

const PREVIOUS = { message: null, failed: false, attempt: 2 };
const ANA = { userId: 'user-a', name: 'Ana', email: 'ana@example.test' };

beforeEach(() => {
  mocks.requireUser.mockResolvedValue(ANA);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('chooseRandomMenuAction', () => {
  it('chooses a menu for the session\'s user and says which one and its Monday', async () => {
    mocks.selectRandomMenu.mockResolvedValue({ ok: true, value: { id: 'id-1', menuNumber: 12, startsOn: '2026-10-05' } });

    const state = await chooseRandomMenuAction(PREVIOUS);

    expect(state).toEqual({ message: 'Te ha tocado el menú 12: empieza el lunes 5 de octubre.', failed: false, attempt: 3 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planner');
  });

  it('says there are no menus when none is stored', async () => {
    mocks.selectRandomMenu.mockResolvedValue({ ok: false, error: { kind: 'no-menus' } });

    await expect(chooseRandomMenuAction(PREVIOUS)).resolves.toEqual({
      message: 'No hay menús para elegir.',
      failed: true,
      attempt: 3,
    });
  });

  it('asks to try again when the database fails', async () => {
    mocks.selectRandomMenu.mockResolvedValue({ ok: false, error: { kind: 'failed' } });

    await expect(chooseRandomMenuAction(PREVIOUS)).resolves.toEqual({
      message: 'No se ha podido elegir el menú. Inténtalo de nuevo.',
      failed: true,
      attempt: 3,
    });
  });

  it('stores nothing without a session: requireUser redirects before the use case runs', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(chooseRandomMenuAction(PREVIOUS)).rejects.toThrow('NEXT_REDIRECT /login');
    expect(mocks.selectRandomMenu).not.toHaveBeenCalled();
  });

  it('ignores every field of the request: the user comes from the session and the menu from the server', async () => {
    mocks.selectRandomMenu.mockResolvedValue({ ok: true, value: { id: 'id-1', menuNumber: 3, startsOn: '2026-10-05' } });
    const form = new FormData();
    form.set('userId', 'user-b');
    form.set('menuNumber', '999');

    // React passes the form as the second argument; the action takes only the state, so the form cannot reach it.
    await (chooseRandomMenuAction as (previous: typeof PREVIOUS, form: FormData) => Promise<unknown>)(PREVIOUS, form);

    expect(mocks.selectRandomMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a' });
  });
});
