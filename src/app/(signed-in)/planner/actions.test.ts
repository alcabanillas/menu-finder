import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseRandomMenuAction, searchMenusAction } from '@/app/(signed-in)/planner/actions';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  selectRandomMenu: vi.fn(),
  searchByText: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/_auth/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ selectRandomMenu: mocks.selectRandomMenu, searchByText: mocks.searchByText }) }));
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

describe('searchMenusAction', () => {
  const IDLE = { status: 'idle' as const, attempt: 0 };

  function formWith(request: FormDataEntryValue | null, extra: Record<string, string> = {}): FormData {
    const form = new FormData();
    if (request !== null) form.set('request', request);
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return form;
  }

  const SEARCH = {
    structure: {
      constraints: [{ id: 'c1', type: 'literal', term: 'garbanzos', polarity: 'include', hard: false }],
      sameDish: [],
      anyOf: [],
    },
    result: {
      strategy: 'hybrid',
      units: [{ kind: 'constraint', constraints: ['c1'] }],
      menus: [{ menu: 12, score: 1, evidence: [{ constraints: ['c1'], dish: null }] }],
      tiedWithFirst: 1,
      ranked: [{ menu: 12, score: 1 }],
      removedBy: [],
    },
  };

  it('searches the trimmed request and returns the view of the ranking', async () => {
    mocks.searchByText.mockResolvedValue({ ok: true, value: SEARCH });

    const state = await searchMenusAction(IDLE, formWith('  garbanzos  '));

    expect(mocks.searchByText).toHaveBeenCalledExactlyOnceWith('garbanzos');
    expect(state).toMatchObject({ status: 'ranking', attempt: 1 });
    expect(state.status === 'ranking' && state.cards.map(({ menu }) => menu)).toEqual([12]);
  });

  it('returns the message of a failed search', async () => {
    mocks.searchByText.mockResolvedValue({ ok: false, error: { kind: 'llm-limit-reached' } });

    await expect(searchMenusAction({ ...IDLE, attempt: 4 }, formWith('garbanzos'))).resolves.toMatchObject({
      status: 'failed',
      kind: 'llm-limit-reached',
      attempt: 5,
    });
  });

  it('runs no search without a session: requireUser redirects before the form is read', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));
    const form = formWith('garbanzos');
    const get = vi.spyOn(form, 'get');

    await expect(searchMenusAction(IDLE, form)).rejects.toThrow('NEXT_REDIRECT /login');
    expect(get).not.toHaveBeenCalled();
    expect(mocks.searchByText).not.toHaveBeenCalled();
  });

  it.each([
    ['a file', formWith(new File(['x'], 'x.txt'))],
    ['no field', formWith(null)],
  ])('treats %s as an empty request and runs no search', async (_name, form) => {
    const state = await searchMenusAction(IDLE, form);

    expect(state).toEqual({ status: 'failed', kind: 'request-too-short', message: 'Escribe qué te apetece.', attempt: 1 });
    expect(mocks.searchByText).not.toHaveBeenCalled();
  });

  it('ignores the extra fields: only the request reaches the search', async () => {
    mocks.searchByText.mockResolvedValue({ ok: true, value: SEARCH });

    await searchMenusAction(IDLE, formWith('garbanzos', { userId: 'user-b', strategy: 'semantic' }));

    expect(mocks.searchByText).toHaveBeenCalledExactlyOnceWith('garbanzos');
  });
});
