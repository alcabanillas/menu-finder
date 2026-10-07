import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RecipeDto } from '@/application/dto/weekly-menu';
import { RecipeCard } from '@/features/weekly-menu/components/recipe-card';

const lentejas: RecipeDto = {
  title: 'Lentejas estofadas',
  times: { total: 45, preparation: 10, cooking: 35, resting: null },
  ingredients: [
    { name: 'Lentejas', householdMeasure: null, quantity: 240, unit: 'g', optional: false },
    { name: 'Aceite de oliva', householdMeasure: '1 cucharada', quantity: 10, unit: 'ml', optional: false },
    { name: 'Laurel', householdMeasure: 'al gusto', quantity: null, unit: null, optional: true },
  ],
  preparation: ['Sofríe las verduras.', 'Añade las lentejas y cuece.'],
};

const toggle = () => screen.getByRole('button', { name: /Lentejas estofadas/ });

describe('RecipeCard', () => {
  it('shows a folded dish with a recipe as a button with its total time and "Receta"', () => {
    render(<RecipeCard name="Lentejas estofadas" recipe={lentejas} />);

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(toggle()).toHaveTextContent('45 min');
    expect(toggle()).toHaveTextContent('Receta');
    expect(screen.queryByText('Ingredientes')).not.toBeInTheDocument();
  });

  it('unfolds the recipe: times, ingredients with their amounts and numbered steps', () => {
    render(<RecipeCard name="Lentejas estofadas" recipe={lentejas} />);

    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'true');
    const recipe = document.getElementById(toggle().getAttribute('aria-controls')!)!;
    const times = within(recipe).getByRole('list', { name: 'Tiempos' });
    expect(within(times).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Total45 min',
      'Preparación10 min',
      'Cocción35 min',
    ]);
    const ingredients = within(recipe).getByRole('list', { name: 'Ingredientes' });
    expect(within(ingredients).getAllByRole('listitem')[0]).toHaveTextContent('Lentejas240 g');
    const steps = within(recipe).getByRole('list', { name: 'Preparación' });
    expect(within(steps).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1Sofríe las verduras.',
      '2Añade las lentejas y cuece.',
    ]);
  });

  it('folds the recipe again', () => {
    render(<RecipeCard name="Lentejas estofadas" recipe={lentejas} />);

    fireEvent.click(toggle());
    fireEvent.click(toggle());

    expect(toggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Ingredientes')).not.toBeInTheDocument();
  });

  it('joins a household measure and a quantity, marks an optional ingredient and dashes an unknown time', () => {
    render(
      <RecipeCard
        name="Lentejas estofadas"
        recipe={{ ...lentejas, times: { ...lentejas.times, cooking: null } }}
      />,
    );

    fireEvent.click(toggle());

    const ingredients = within(screen.getByRole('list', { name: 'Ingredientes' })).getAllByRole('listitem');
    expect(ingredients[1]).toHaveTextContent('Aceite de oliva1 cucharada · 10 ml');
    expect(ingredients[2]).toHaveTextContent('Laurel · opcionalal gusto');
    const times = within(screen.getByRole('list', { name: 'Tiempos' })).getAllByRole('listitem');
    expect(times[2]).toHaveTextContent('Cocción—');
  });

  it('shows a dish without a recipe with "Sin receta" and no control', () => {
    render(<RecipeCard name="Fruta de temporada" recipe={null} />);

    expect(screen.getByText('Fruta de temporada')).toBeInTheDocument();
    expect(screen.getByText('Sin receta')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
