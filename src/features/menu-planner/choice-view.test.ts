import { describe, expect, it } from 'vitest';
import { err, ok } from '@/shared/result';
import { toChoiceState } from '@/features/menu-planner/choice-view';

const chosen = ok({ id: 'new-1', menuNumber: 22, startsOn: '2026-10-12' as const });

describe('toChoiceState', () => {
  it('describes a chosen menu with its week and the link to see it', () => {
    expect(toChoiceState(chosen, 'next', 3)).toEqual({
      status: 'chosen',
      menu: 22,
      week: 'next',
      message: 'Menú 22 para la semana del 12 oct.',
      weekHref: '/menu?startsOn=2026-10-12',
      attempt: 3,
    });
  });

  it.each([
    ['invalid-menu', 'Ese menú no existe.'],
    ['unknown-menu', 'Ese menú no existe.'],
    ['invalid-week', 'Esa semana no se puede elegir.'],
    ['week-locked', 'Esta semana ya no se puede cambiar: ya has elegido la de la semana que viene.'],
    ['failed', 'No se ha podido elegir el menú. Inténtalo de nuevo.'],
    ['no-menus', 'No hay menús para elegir.'],
  ] as const)('gives the message of the failure %s', (kind, message) => {
    expect(toChoiceState(err({ kind }), 'current', 2)).toEqual({ status: 'failed', kind, message, attempt: 2 });
  });
});
