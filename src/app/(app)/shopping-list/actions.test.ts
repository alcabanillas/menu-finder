import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkItemsAction } from '@/app/(app)/shopping-list/actions';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  checkShoppingItems: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/app/_session/require-user', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/composition/web-container', () => ({ webContainer: () => ({ checkShoppingItems: mocks.checkShoppingItems }) }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

const PREVIOUS = { message: null, attempt: 2 };
const ANA = { userId: 'user-a', name: 'Ana', email: 'ana@example.test' };

function formOf(fields: [string, string][]): FormData {
  const form = new FormData();
  for (const [name, value] of fields) form.append(name, value);
  return form;
}

const TICK = formOf([
  ['menuNumber', '9101'],
  ['position', '1'],
  ['position', '2'],
  ['checked', 'true'],
]);

beforeEach(() => {
  mocks.requireUser.mockResolvedValue(ANA);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('checkItemsAction', () => {
  it("ticks for the session's user, redraws the page and answers without a message", async () => {
    mocks.checkShoppingItems.mockResolvedValue({ ok: true, value: undefined });

    const state = await checkItemsAction(PREVIOUS, TICK);

    expect(state).toEqual({ message: null, attempt: 3 });
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/shopping-list');
    expect(mocks.checkShoppingItems).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-a',
      menuNumber: '9101',
      positions: ['1', '2'],
      checked: 'true',
    });
  });

  it('stores nothing without a session: requireUser redirects before the use case runs', async () => {
    mocks.requireUser.mockRejectedValue(new Error('NEXT_REDIRECT /login'));

    await expect(checkItemsAction(PREVIOUS, TICK)).rejects.toThrow('NEXT_REDIRECT /login');
    expect(mocks.checkShoppingItems).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('ignores fields naming a user or a selection: only the session user and the three fields are passed', async () => {
    mocks.checkShoppingItems.mockResolvedValue({ ok: true, value: undefined });
    const form = formOf([
      ['userId', 'user-b'],
      ['selectionId', 'selection-of-b'],
      ['menuNumber', '12'],
      ['position', '3'],
      ['checked', 'false'],
    ]);

    await checkItemsAction(PREVIOUS, form);

    expect(mocks.checkShoppingItems).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-a',
      menuNumber: '12',
      positions: ['3'],
      checked: 'false',
    });
  });

  it.each([
    ['invalid', 'No se ha podido marcar. Recarga la página.'],
    ['stale', 'La lista ha cambiado. Recarga la página.'],
    ['failed', 'No se ha podido guardar. Inténtalo de nuevo.'],
  ])('says why a %s tick was refused and does not redraw', async (kind, message) => {
    mocks.checkShoppingItems.mockResolvedValue({ ok: false, error: { kind } });

    await expect(checkItemsAction(PREVIOUS, TICK)).resolves.toEqual({ message, attempt: 3 });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it('passes missing fields on as they are, for the use case to refuse', async () => {
    mocks.checkShoppingItems.mockResolvedValue({ ok: false, error: { kind: 'invalid' } });

    await checkItemsAction(PREVIOUS, new FormData());

    expect(mocks.checkShoppingItems).toHaveBeenCalledExactlyOnceWith({
      userId: 'user-a',
      menuNumber: null,
      positions: [],
      checked: null,
    });
  });
});
