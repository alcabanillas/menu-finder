import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PreviewState } from '@/features/menu-planner/preview-view';
import { useWeekPreview } from '@/features/menu-planner/use-week-preview';

const READY = (menu: number): PreviewState => ({ status: 'ready', preview: { menuNumber: menu, days: [] } });

function Harness({ action }: { action: (menu: number) => Promise<PreviewState> }) {
  const preview = useWeekPreview(action);
  return (
    <div>
      {[12, 3].map((menu) => (
        <button key={menu} type="button" onClick={(event) => preview.toggle(menu, event.currentTarget)}>
          Ver {menu}
        </button>
      ))}
      <button type="button" onClick={preview.close}>
        Cerrar
      </button>
      <button type="button" onClick={preview.reset}>
        Reiniciar
      </button>
      <p data-testid="open">{String(preview.open)}</p>
      <p data-testid="state">{preview.open === null ? '-' : (preview.stateOf(preview.open)?.status ?? 'loading')}</p>
    </div>
  );
}

const open = () => screen.getByTestId('open').textContent;
const state = () => screen.getByTestId('state').textContent;

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('useWeekPreview', () => {
  it('opens a menu as loading and then ready, once the action answers', async () => {
    let answer: (state: PreviewState) => void = () => {};
    const action = vi.fn(() => new Promise<PreviewState>((resolve) => (answer = resolve)));
    render(<Harness action={action} />);

    await click('Ver 12');
    expect(open()).toBe('12');
    expect(state()).toBe('loading');
    expect(action).toHaveBeenCalledExactlyOnceWith(12);

    await act(async () => answer(READY(12)));
    expect(state()).toBe('ready');
  });

  it('reads a menu once: opening it again shows it at once', async () => {
    const action = vi.fn(async (menu: number) => READY(menu));
    render(<Harness action={action} />);

    await click('Ver 12');
    await click('Cerrar');
    await click('Ver 12');

    expect(action).toHaveBeenCalledTimes(1);
    expect(state()).toBe('ready');
  });

  it('shows the other menu when another card is opened, with only one open', async () => {
    const action = vi.fn(async (menu: number) => READY(menu));
    render(<Harness action={action} />);

    await click('Ver 12');
    await click('Ver 3');

    expect(open()).toBe('3');
    expect(action).toHaveBeenCalledTimes(2);
  });

  it('closes when the open card is toggled again', async () => {
    render(<Harness action={async (menu) => READY(menu)} />);

    await click('Ver 12');
    await click('Ver 12');

    expect(open()).toBe('null');
  });

  it('does not keep a read that failed: opening the menu again asks again', async () => {
    const failed: PreviewState = { status: 'failed', message: 'No se ha podido cargar la semana. Inténtalo de nuevo.' };
    const action = vi.fn().mockResolvedValueOnce(failed).mockResolvedValueOnce(READY(12));
    render(<Harness action={action} />);

    await click('Ver 12');
    expect(state()).toBe('failed');
    await click('Cerrar');
    await click('Ver 12');

    expect(action).toHaveBeenCalledTimes(2);
    expect(state()).toBe('ready');
  });

  it('turns a throwing action into the failed message', async () => {
    render(<Harness action={async () => Promise.reject(new Error('network'))} />);

    await click('Ver 12');

    expect(state()).toBe('failed');
  });

  it('gives the focus back to the button of the card when it closes', async () => {
    render(<Harness action={async (menu) => READY(menu)} />);
    await click('Ver 12');
    screen.getByRole('button', { name: 'Cerrar' }).focus();

    await click('Cerrar');

    expect(screen.getByRole('button', { name: 'Ver 12' })).toHaveFocus();
  });

  it('gives the focus back without scrolling the page', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    render(<Harness action={async (menu) => READY(menu)} />);
    await click('Ver 12');

    await click('Cerrar');

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('closes without moving the focus when it is reset, as a new search does', async () => {
    render(<Harness action={async (menu) => READY(menu)} />);
    await click('Ver 12');
    const reset = screen.getByRole('button', { name: 'Reiniciar' });
    reset.focus();

    await click('Reiniciar');

    expect(open()).toBe('null');
    expect(screen.getByRole('button', { name: 'Ver 12' })).not.toHaveFocus();
  });
});
