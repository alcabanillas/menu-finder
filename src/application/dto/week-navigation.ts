/** Where the week on show sits in the window: before this week, this week, or the next one. */
export type WeekStatusDto = 'past' | 'current' | 'future';

/** The week on show and the weeks the header may step to, as `YYYY-MM-DD` Mondays; `null` where the window ends. */
export type WeekNavigationDto = {
  shown: string;
  current: string;
  previous: string | null;
  next: string | null;
  status: WeekStatusDto;
  /** The seven dates of the week on show, Monday to Sunday. */
  days: string[];
};
