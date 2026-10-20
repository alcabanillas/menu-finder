import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chooseMenuAction, previewMenuAction, searchMenusAction } from '@/app/(signed-in)/planner/actions';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  selectRandomMenu: vi.fn(),
  chooseMenu: vi.fn(),
  searchByText: vi.fn(),
  menuPreview: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/_auth/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ selectRandomMenu: mocks.selectRandomMenu, chooseMenu: mocks.chooseMenu, searchByText: mocks.searchByText, menuPreview: mocks.menuPreview }) }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

const ANA = { userId: 'user-a', name: 'Ana', email: 'ana@example.test' };

beforeEach(() => {
  mocks.requireUser.mockResolvedValue(ANA);
});

afterEach(() => {
  vi.resetAllMocks();
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

    expect(mocks.searchByText).toHaveBeenCalledExactlyOnceWith('user-a', 'garbanzos');
    expect(state).toMatchObject({ status: 'ranking', attempt: 1 });
    expect(state.status === 'ranking' && state.cards.map(({ menu }) => menu)).toEqual([12]);
  });

  it('returns the request as it was sent, untrimmed, so that the page can put it back in the box', async () => {
    mocks.searchByText.mockResolvedValue({ ok: true, value: SEARCH });

    const state = await searchMenusAction(IDLE, formWith('  garbanzos  '));

    expect(state.status === 'ranking' && state.request).toBe('  garbanzos  ');
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

    expect(mocks.searchByText).toHaveBeenCalledExactlyOnceWith('user-a', 'garbanzos');
  });
});

describe('chooseMenuAction', () => {
  const IDLE = { status: 'idle' as const, attempt: 4 };

  function choiceForm(fields: Record<string, FormDataEntryValue>): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, value);
    return form;
  }

  it('chooses for an empty week: the menu and the week reach chooseMenu with the session’s user', async () => {
    mocks.chooseMenu.mockResolvedValue({ ok: true, value: { id: 'id-1', menuNumber: 22, startsOn: '2026-10-12' } });

    const state = await chooseMenuAction(IDLE, choiceForm({ menu: '22', week: 'next' }));

    expect(mocks.chooseMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a', menuNumber: '22', week: 'next' });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/planner');
    expect(state).toEqual({
      status: 'chosen',
      menu: 22,
      week: 'next',
      message: 'Menú 22 para la semana del 12 oct.',
      weekHref: '/menu?startsOn=2026-10-12',
      attempt: 5,
    });
  });

  it('chooses nothing without a session: requireUser redirects before the form is read', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));
    const form = choiceForm({ menu: '22', week: 'next' });
    const read = vi.spyOn(form, 'get');

    await expect(chooseMenuAction(IDLE, form)).rejects.toThrow('NEXT_REDIRECT /login');

    expect(read).not.toHaveBeenCalled();
    expect(mocks.chooseMenu).not.toHaveBeenCalled();
  });

  it.each([
    ['a file', choiceForm({ menu: new File(['x'], 'menu.txt'), week: 'next' })],
    ['a missing field', choiceForm({ week: 'next' })],
  ])('passes a menu number that is %s as undefined and shows the failure', async (_name, form) => {
    mocks.chooseMenu.mockResolvedValue({ ok: false, error: { kind: 'invalid-menu' } });

    const state = await chooseMenuAction(IDLE, form);

    expect(mocks.chooseMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a', menuNumber: undefined, week: 'next' });
    expect(state).toEqual({ status: 'failed', kind: 'invalid-menu', message: 'Ese menú no existe.', attempt: 5 });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['a file', choiceForm({ menu: '22', week: new File(['x'], 'week.txt') })],
    ['a missing field', choiceForm({ menu: '22' })],
  ])('passes a week that is %s as undefined and shows the failure', async (_name, form) => {
    mocks.chooseMenu.mockResolvedValue({ ok: false, error: { kind: 'invalid-week' } });

    const state = await chooseMenuAction(IDLE, form);

    expect(mocks.chooseMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a', menuNumber: '22', week: undefined });
    expect(state).toMatchObject({ status: 'failed', kind: 'invalid-week', message: 'Esa semana no se puede elegir.' });
  });

  it('says this week cannot be changed when a forged choice reaches a locked week', async () => {
    mocks.chooseMenu.mockResolvedValue({ ok: false, error: { kind: 'week-locked' } });

    const state = await chooseMenuAction(IDLE, choiceForm({ menu: '22', week: 'current' }));

    expect(state).toMatchObject({
      status: 'failed',
      kind: 'week-locked',
      message: 'Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene.',
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('ignores every other field of the request: the user comes from the session', async () => {
    mocks.chooseMenu.mockResolvedValue({ ok: true, value: { id: 'id-1', menuNumber: 22, startsOn: '2026-10-05' } });

    await chooseMenuAction(IDLE, choiceForm({ menu: '22', week: 'current', userId: 'user-b', startsOn: '2026-10-19' }));

    expect(mocks.chooseMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a', menuNumber: '22', week: 'current' });
  });

  it('asks to try again when the database fails, without refreshing the page', async () => {
    mocks.chooseMenu.mockResolvedValue({ ok: false, error: { kind: 'failed' } });

    const state = await chooseMenuAction(IDLE, choiceForm({ menu: '22', week: 'next' }));

    expect(state).toMatchObject({ status: 'failed', kind: 'failed', message: 'No se ha podido elegir el menú. Inténtalo de nuevo.' });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  describe('with the random button', () => {
    it('chooses a random menu for the selected week and says where it went', async () => {
      mocks.selectRandomMenu.mockResolvedValue({ ok: true, value: { id: 'id-1', menuNumber: 7, startsOn: '2026-10-12' } });

      const state = await chooseMenuAction(IDLE, choiceForm({ random: '1', week: 'next' }));

      expect(mocks.selectRandomMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a', week: 'next' });
      expect(mocks.chooseMenu).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/planner');
      expect(state).toMatchObject({ status: 'chosen', menu: 7, week: 'next', message: 'Menú 7 para la semana del 12 oct.', attempt: 5 });
    });

    it('chooses nothing without a session: requireUser redirects before the form is read', async () => {
      mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));
      const form = choiceForm({ random: '1', week: 'next' });
      const read = vi.spyOn(form, 'get');

      await expect(chooseMenuAction(IDLE, form)).rejects.toThrow('NEXT_REDIRECT /login');

      expect(read).not.toHaveBeenCalled();
      expect(mocks.selectRandomMenu).not.toHaveBeenCalled();
    });

    it('passes a missing week as undefined and ignores every other field', async () => {
      mocks.selectRandomMenu.mockResolvedValue({ ok: false, error: { kind: 'invalid-week' } });

      const state = await chooseMenuAction(IDLE, choiceForm({ random: '1', userId: 'user-b', menu: '999' }));

      expect(mocks.selectRandomMenu).toHaveBeenCalledExactlyOnceWith({ userId: 'user-a', week: undefined });
      expect(state).toMatchObject({ status: 'failed', kind: 'invalid-week' });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('says there are no menus when none is stored', async () => {
      mocks.selectRandomMenu.mockResolvedValue({ ok: false, error: { kind: 'no-menus' } });

      await expect(chooseMenuAction(IDLE, choiceForm({ random: '1', week: 'current' }))).resolves.toEqual({
        status: 'failed',
        kind: 'no-menus',
        message: 'No hay menús para elegir.',
        attempt: 5,
      });
    });

    it('takes any other value of the field as a normal choice', async () => {
      mocks.chooseMenu.mockResolvedValue({ ok: true, value: { id: 'id-1', menuNumber: 22, startsOn: '2026-10-05' } });

      await chooseMenuAction(IDLE, choiceForm({ random: '0', menu: '22', week: 'current' }));

      expect(mocks.selectRandomMenu).not.toHaveBeenCalled();
      expect(mocks.chooseMenu).toHaveBeenCalledOnce();
    });
  });
});

describe('previewMenuAction', () => {
  const PREVIEW = { menuNumber: 22, days: [{ day: 'monday', lunch: ['Garbanzos'], dinner: [] }] };

  it('reads the preview of the menu and returns it as ready', async () => {
    mocks.menuPreview.mockResolvedValue({ ok: true, value: PREVIEW });

    const state = await previewMenuAction(22);

    expect(mocks.menuPreview).toHaveBeenCalledExactlyOnceWith({ menuNumber: 22 });
    expect(state).toEqual({ status: 'ready', preview: PREVIEW });
  });

  it('reads nothing without a session: requireUser redirects before the value is read', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(previewMenuAction(22)).rejects.toThrow('NEXT_REDIRECT /login');

    expect(mocks.menuPreview).not.toHaveBeenCalled();
  });

  it.each([['invalid-menu'], ['unknown-menu']])('says the menu does not exist for %s', async (kind) => {
    mocks.menuPreview.mockResolvedValue({ ok: false, error: { kind } });

    await expect(previewMenuAction('12abc')).resolves.toEqual({ status: 'failed', message: 'Ese menú no existe.' });
  });

  it('asks to try again when reading the menu fails', async () => {
    mocks.menuPreview.mockResolvedValue({ ok: false, error: { kind: 'failed' } });

    await expect(previewMenuAction(22)).resolves.toEqual({
      status: 'failed',
      message: 'No se ha podido cargar la semana. Inténtalo de nuevo.',
    });
  });

  it('passes the value on as it came, for the use case to validate', async () => {
    mocks.menuPreview.mockResolvedValue({ ok: false, error: { kind: 'invalid-menu' } });
    const file = new Blob(['x']);

    await previewMenuAction(file);

    expect(mocks.menuPreview).toHaveBeenCalledExactlyOnceWith({ menuNumber: file });
  });
});
