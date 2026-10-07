import type { LocalDate } from '@/domain/selection/local-date';

/** Today's calendar date where the users live (Europe/Madrid), not where the server runs. */
export interface Clock {
  today(): LocalDate;
}
