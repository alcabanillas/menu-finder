'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/_session/require-user';
import type { CheckShoppingItemsFailure } from '@/application/use-cases/check-shopping-items';
import { webContainer } from '@/composition/web-container';
import type { CheckItemsState } from '@/features/shopping-list/check-items-state';

const MESSAGES: Record<CheckShoppingItemsFailure['kind'], string> = {
  invalid: 'No se ha podido marcar. Recarga la página.',
  stale: 'La lista ha cambiado. Recarga la página.',
  failed: 'No se ha podido guardar. Inténtalo de nuevo.',
};

/**
 * The tick of a row or of a category. The session is checked first, because a server action is a public POST endpoint;
 * the form gives only `menuNumber`, `position` and `checked`, and the user comes from the session.
 */
export async function checkItemsAction(previous: CheckItemsState, form: FormData): Promise<CheckItemsState> {
  const user = await requireUser();
  const result = await webContainer().checkShoppingItems({
    userId: user.userId,
    menuNumber: form.get('menuNumber'),
    positions: form.getAll('position'),
    checked: form.get('checked'),
  });
  const attempt = previous.attempt + 1;
  if (!result.ok) return { message: MESSAGES[result.error.kind], attempt };

  revalidatePath('/shopping-list');
  return { message: null, attempt };
}
