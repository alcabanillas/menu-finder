'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/app/_auth/require-user';
import { webContainer } from '@/composition/web-container';
import { toChoiceState, type ChoiceState } from '@/features/menu-planner/choice-view';
import { toSearchState, type PlannerSearchState } from '@/features/menu-planner/search-view';
import { err } from '@/shared/result';

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

/**
 * The planner's choice. The session is checked before the form is read, because a server action is a public POST
 * endpoint. Only `menu`, `random` and `week` are read, as text: with `random` the server picks the menu, otherwise
 * `chooseMenu` parses the number; either way the week is validated, the Monday computed and the lock applied, and the user
 * comes from the session.
 */
export async function chooseMenuAction(previous: ChoiceState, formData: FormData): Promise<ChoiceState> {
  const user = await requireUser();
  const week = textOf(formData, 'week');
  const result =
    textOf(formData, 'random') === '1'
      ? await webContainer().selectRandomMenu({ userId: user.userId, week })
      : await webContainer().chooseMenu({ userId: user.userId, menuNumber: textOf(formData, 'menu'), week });
  if (result.ok) revalidatePath('/planner');
  return toChoiceState(result, week === 'next' ? 'next' : 'current', previous.attempt + 1);
}

function textOf(formData: FormData, field: string): string | undefined {
  const value = formData.get(field);
  return typeof value === 'string' ? value : undefined;
}
