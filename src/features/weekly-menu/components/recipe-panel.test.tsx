import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RecipeDto } from '@/application/dto/weekly-menu';
import { RecipePanel } from '@/features/weekly-menu/components/recipe-panel';

const RECIPE: RecipeDto = {
  title: 'Lentejas estofadas',
  times: { total: 45, preparation: 10, cooking: null, resting: null },
  ingredients: [{ name: 'Lentejas', householdMeasure: null, quantity: 240, unit: 'g', optional: false }],
  preparation: ['Sofreír las verduras.', 'Cocer las lentejas.'],
};

function renderPanel(onClose = () => {}) {
  return render(<RecipePanel name="Lentejas estofadas" eyebrow="Miércoles · Comida" recipe={RECIPE} onClose={onClose} />);
}

describe('RecipePanel', () => {
  it('is a dialog named after the dish, with its day and meal and the recipe as the card shows it', () => {
    renderPanel();

    const dialog = screen.getByRole('dialog', { name: 'Lentejas estofadas' });
    expect(within(dialog).getByText('Miércoles · Comida')).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: 'Tiempos' })).toHaveTextContent(/45\s*min.*10\s*min.*—/);
    expect(within(dialog).getByRole('list', { name: 'Ingredientes' })).toHaveTextContent(/Lentejas\s*240 g/);
    expect(within(dialog).getAllByRole('listitem').at(-1)).toHaveTextContent(/^2\s*Cocer las lentejas\.$/);
  });

  it('takes the focus on its close button when it opens', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Cerrar receta' })).toHaveFocus();
  });

  it('asks to close on Escape, with its close button and with the backdrop', () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar receta' }));
    fireEvent.click(document.querySelector('[data-backdrop]') as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('is a modal 400 px panel against the right edge of the window, below the header, like the week preview of Buscar', () => {
    renderPanel();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('fixed', 'top-16', 'right-0', 'bottom-0', 'w-[400px]', 'border-l');
    expect(dialog.className).not.toMatch(/1440px|left-/);
    expect(document.querySelector('[data-backdrop]')).toHaveClass('fixed', 'top-16', 'bg-ink/40');
  });

  it('keeps the page behind still while it is open', () => {
    const { unmount } = renderPanel();

    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).toBe('');
  });
});
