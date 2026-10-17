import type { Week } from '@/domain/selection/week';

export type { Week };

/** One week of the selector: its Monday and Sunday (`YYYY-MM-DD`), the menu it has or `null`, and whether it cannot take a choice. */
export type WeekToChooseDto = { startsOn: string; endsOn: string; menuNumber: number | null; locked: boolean };

/** This week and next week as the selector shows them, and the one it starts on. */
export type WeeksToChooseDto = { current: WeekToChooseDto; next: WeekToChooseDto; suggested: Week };
