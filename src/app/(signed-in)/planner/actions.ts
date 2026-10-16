'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/_auth/require-user';
import type { SelectRandomMenuFailure } from '@/application/use-cases/menu/select-random-menu';
import { webContainer } from '@/composition/web-container';
import type { RandomMenuState } from '@/features/menu-planner/components/random-menu-form';
import { toSearchState, type PlannerSearchState } from '@/features/menu-planner/search-view';
import { formatMonday } from '@/shared/format-monday';
import { err } from '@/shared/result';

const MESSAGES: Record<SelectRandomMenuFailure['kind'], string> = {
  'no-menus': 'No hay menús para elegir.',
  failed: 'No se ha podido elegir el menú. Inténtalo de nuevo.',
};

/**
 * The planner's button. The session is checked first, because a server action is a public POST endpoint; the form is
 * never read: the user comes from the session and the menu is picked on the server.
 */
export async function chooseRandomMenuAction(previous: RandomMenuState): Promise<RandomMenuState> {
  const user = await requireUser();
  const result = await webContainer().selectRandomMenu({ userId: user.userId });
  const attempt = previous.attempt + 1;
  if (!result.ok) return { message: MESSAGES[result.error.kind], failed: true, attempt };

  revalidatePath('/planner');
  const { menuNumber, startsOn } = result.value;
  return { message: `Te ha tocado el menú ${menuNumber}: empieza el ${formatMonday(startsOn)}.`, failed: false, attempt };
}

/**
 * The planner's search. The session is checked before the form is read, because a server action is a public POST
 * endpoint. Only the `request` field is read, and a value that is not text is an empty request; the user, whose
 * daily limit the search spends, comes from the session, and the strategy is the web's own (MF-22.4 design D1, D2b).
 */
export async function searchMenusAction(previous: PlannerSearchState, formData: FormData): Promise<PlannerSearchState> {
  const user = await requireUser();
  const attempt = previous.attempt + 1;
  const request = formData.get('request');
  if (typeof request !== 'string') return toSearchState(err({ kind: 'request-too-short' }), attempt);
  return toSearchState(await webContainer().searchByText(user.userId, request.trim()), attempt);
}
