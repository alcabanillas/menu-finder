/**
 * Why a choice stored nothing. `invalid-menu`: not a positive integer; `invalid-week`: not `current` or `next`;
 * `week-locked`: this week once next week has a menu; `unknown-menu`: no menu has that number; `failed`: a fault of
 * the system.
 */
export type ChooseMenuFailure =
  | { kind: 'invalid-menu' }
  | { kind: 'invalid-week' }
  | { kind: 'week-locked' }
  | { kind: 'unknown-menu' }
  | { kind: 'failed' };

/** Why the random button stored nothing: any failure of a choice, or `no-menus` when there is nothing to pick from. */
export type ChooseRandomMenuFailure = ChooseMenuFailure | { kind: 'no-menus' };
