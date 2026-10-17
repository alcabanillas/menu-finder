import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WeeksToChooseDto } from '@/application/dto/weeks-to-choose';
import type { ChoiceState } from '@/features/menu-planner/choice-view';
import { WeekSelector } from '@/features/menu-planner/components/week-selector';

const EMPTY: WeeksToChooseDto = {
  current: { startsOn: '2026-10-05', endsOn: '2026-10-11', menuNumber: null, locked: false },
  next: { startsOn: '2026-10-12', endsOn: '2026-10-18', menuNumber: null, locked: false },
  suggested: 'current',
};
const THIS_WEEK_CHOSEN: WeeksToChooseDto = {
  current: { ...EMPTY.current, menuNumber: 14 },
  next: EMPTY.next,
  suggested: 'next',
};
const LOCKED: WeeksToChooseDto = {
  current: { ...EMPTY.current, menuNumber: 3, locked: true },
  next: { ...EMPTY.next, menuNumber: 12 },
  suggested: 'next',
};
const IDLE: ChoiceState = { status: 'idle', attempt: 0 };
const FORM = 'choose-form';

function renderSelector(
  weeks: WeeksToChooseDto | null,
  selected: 'current' | 'next',
  overrides: { choice?: ChoiceState; onSelect?: (week: 'current' | 'next') => void } = {},
) {
  return render(
    <WeekSelector
      weeks={weeks}
      selected={selected}
      onSelect={overrides.onSelect ?? (() => undefined)}
      formId={FORM}
      choice={overrides.choice ?? IDLE}
    />,
  );
}

describe('WeekSelector', () => {
  it('names the choice "Eligiendo menú para" and offers this week and next week as radios of the choose form', () => {
    renderSelector(EMPTY, 'current');

    const group = screen.getByRole('group', { name: 'Eligiendo menú para' });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((radio) => radio.getAttribute('value'))).toEqual(['current', 'next']);
    for (const radio of radios) {
      expect(radio).toHaveAttribute('name', 'week');
      expect(radio).toHaveAttribute('form', FORM);
    }
  });

  it('shows each week with its dates and "Sin menú" when it has none', () => {
    renderSelector(EMPTY, 'current');

    expect(screen.getByRole('radio', { name: /Esta semana/ })).toHaveAccessibleName(/5 – 11 oct.*Sin menú/);
    expect(screen.getByRole('radio', { name: /La que viene/ })).toHaveAccessibleName(/12 – 18 oct.*Sin menú/);
  });

  it('shows "Menú N" for a week that has a menu', () => {
    renderSelector(THIS_WEEK_CHOSEN, 'next');

    expect(screen.getByRole('radio', { name: /Esta semana/ })).toHaveAccessibleName(/Menú 14/);
  });

  it('checks the selected week only', () => {
    renderSelector(THIS_WEEK_CHOSEN, 'next');

    expect(screen.getByRole('radio', { name: /La que viene/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Esta semana/ })).not.toBeChecked();
  });

  it('says where the menu will go when the selected week is empty', () => {
    renderSelector(EMPTY, 'current');

    expect(screen.getByText('El menú que elijas irá a la semana del 5 oct.')).toBeInTheDocument();
  });

  it('says inside the selected option that another menu replaces the one it has, and draws no line under the options', () => {
    renderSelector(THIS_WEEK_CHOSEN, 'current');

    const radio = screen.getByRole('radio', { name: /Esta semana/ });
    expect(radio).toHaveAccessibleName(/Menú 14.*Si eliges otro, lo sustituye/);
    expect(radio.closest('label')?.querySelector('svg[data-icon="repeat"]')).toBeInTheDocument();
    expect(screen.queryByText(/ya tiene el Menú/)).not.toBeInTheDocument();
    expect(screen.queryByText(/El menú que elijas irá/)).not.toBeInTheDocument();
  });

  it('says nothing about replacing in an option that is not selected', () => {
    renderSelector(LOCKED, 'next');

    expect(screen.getByRole('radio', { name: /La que viene/ })).toHaveAccessibleName(/Si eliges otro, lo sustituye/);
    expect(screen.getByRole('radio', { name: /Esta semana/ })).not.toHaveAccessibleName(/lo sustituye/);
  });

  it('asks before replacing with a random menu, with the buttons Cambiar and Cancelar', () => {
    const onCancel = vi.fn();
    render(
      <WeekSelector
        weeks={THIS_WEEK_CHOSEN}
        selected="current"
        onSelect={() => undefined}
        formId={FORM}
        choice={IDLE}
        asking={{ text: '¿Cambiar el Menú 14 por uno al azar en la semana del 5 oct?', onCancel }}
      />,
    );

    const box = screen.getByRole('group', { name: 'Confirmar cambio' });
    expect(box).toHaveTextContent('¿Cambiar el Menú 14 por uno al azar en la semana del 5 oct?');
    const change = screen.getByRole('button', { name: 'Cambiar' });
    expect(change).toHaveAttribute('type', 'submit');
    expect(change).toHaveAttribute('name', 'random');
    expect(change).toHaveAttribute('form', FORM);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('reports the week the user picks', () => {
    const onSelect = vi.fn();
    renderSelector(EMPTY, 'current', { onSelect });

    fireEvent.click(screen.getByRole('radio', { name: /La que viene/ }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith('next');
  });

  it('disables a locked "Esta semana" and marks it "Cerrada" inside its card, with a padlock and a dashed border', () => {
    renderSelector(LOCKED, 'next');

    const radio = screen.getByRole('radio', { name: /Esta semana/ });
    const card = radio.closest('label') as HTMLElement;
    expect(radio).toBeDisabled();
    expect(radio).toHaveAccessibleName(/Cerrada/);
    expect(card.querySelector('svg[data-icon="lock"]')).toBeInTheDocument();
    expect(card).toHaveClass('border-dashed');
    expect(screen.queryByText(/No se puede cambiar/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /La que viene/ })).toBeEnabled();
  });

  it('says the menu was chosen, with a "Ver semana" link to that week', () => {
    const choice: ChoiceState = {
      status: 'chosen',
      menu: 22,
      week: 'next',
      message: 'Menú 22 para la semana del 12 oct.',
      weekHref: '/menu?startsOn=2026-10-12',
      attempt: 1,
    };
    renderSelector(EMPTY, 'next', { choice });

    expect(screen.getByRole('status')).toHaveTextContent('Menú 22 para la semana del 12 oct.');
    expect(screen.getByRole('link', { name: /Ver semana/ })).toHaveAttribute('href', '/menu?startsOn=2026-10-12');
    expect(screen.queryByText(/El menú que elijas irá/)).not.toBeInTheDocument();
  });

  it('does not show the done line for a failed choice', () => {
    const choice: ChoiceState = { status: 'failed', kind: 'failed', message: 'x', attempt: 1 };
    renderSelector(EMPTY, 'current', { choice });

    expect(screen.queryByRole('link', { name: /Ver semana/ })).not.toBeInTheDocument();
    expect(screen.getByText('El menú que elijas irá a la semana del 5 oct.')).toBeInTheDocument();
  });

  it('says the weeks could not be loaded, in place of the options', () => {
    renderSelector(null, 'current');

    expect(screen.getByText('No se ha podido cargar tu menú.')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});
