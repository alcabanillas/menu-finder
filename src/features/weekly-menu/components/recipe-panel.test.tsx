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

function renderPanel(onClose = () => {}, side: 'left' | 'right' = 'right') {
  return render(
    <RecipePanel name="Lentejas estofadas" eyebrow="Miércoles · Comida" recipe={RECIPE} side={side} onClose={onClose} />,
  );
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

  it('asks to close on Escape', () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('asks to close with its close button', () => {
    const onClose = vi.fn();
    renderPanel(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar receta' }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('lies on the side it is given', () => {
    renderPanel(() => {}, 'left');

    expect(screen.getByRole('dialog')).toHaveAttribute('data-side', 'left');
  });
});
