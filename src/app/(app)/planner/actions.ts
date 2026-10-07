'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/_session/require-user';
import type { SelectRandomMenuFailure } from '@/application/use-cases/select-random-menu';
import { webContainer } from '@/composition/web-container';
import type { RandomMenuState } from '@/features/menu-planner/components/random-menu-form';
import { formatMonday } from '@/features/menu-planner/format-monday';

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
