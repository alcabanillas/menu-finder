import type { DayDto } from '@/application/dto/weekly-menu';

// The colour bar of each day, as in the design system; the classes are literal so Tailwind keeps them. Sunday's colour
// is the page's, so it gets a border.
export const DAY_BARS: Record<DayDto, string> = {
  monday: 'bg-day-mon',
  tuesday: 'bg-day-tue',
  wednesday: 'bg-day-wed',
  thursday: 'bg-day-thu',
  friday: 'bg-day-fri',
  saturday: 'bg-day-sat',
  sunday: 'bg-day-sun border border-border-strong',
};
