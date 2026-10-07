import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SelectionSummary } from '@/features/menu-planner/components/selection-summary';

describe('SelectionSummary', () => {
  it('reads "Sin elegir" for both weeks when nothing is chosen', () => {
    render(
      <SelectionSummary
        selections={{ activeMenu: null, shoppingList: null }}
      />,
    );

    expect(weekText('Esta semana')).toContain('Sin elegir');
    expect(weekText('La semana que viene')).toContain('Sin elegir');
  });

  it("shows this week's menu and next week's, each with its Monday", () => {
    render(
      <SelectionSummary
        selections={{
          activeMenu: { menuNumber: 3, startsOn: '2026-10-05' },
          shoppingList: { menuNumber: 12, startsOn: '2026-10-12' },
        }}
      />,
    );

    expect(weekText('Esta semana')).toContain(
      'Menú 3 · desde el lunes 5 de octubre',
    );
    expect(weekText('La semana que viene')).toContain(
      'Menú 12 · desde el lunes 12 de octubre',
    );
  });

  it("shows only this week when the shopping list is still this week's menu", () => {
    const active = { menuNumber: 3, startsOn: '2026-10-05' };
    render(
      <SelectionSummary
        selections={{ activeMenu: active, shoppingList: active }}
      />,
    );

    expect(weekText('Esta semana')).toContain('Menú 3');
    expect(weekText('La semana que viene')).toContain('Sin elegir');
  });

  it('says the menu could not be loaded when the selections are missing', () => {
    render(<SelectionSummary selections={null} />);

    expect(
      screen.getByText('No se ha podido cargar tu menú.'),
    ).toBeInTheDocument();
  });
});

function weekText(label: string): string {
  return screen.getByText(label).closest('div')!.textContent!;
}
