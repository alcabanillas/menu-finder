import { describe, expect, it } from 'vitest';
import { neighbouringWeeks } from '@/domain/selection/starts-on';

const TODAY = '2026-10-09';
const THIS_MONDAY = '2026-10-05';

describe('neighbouringWeeks', () => {
  it('gives the week before and the next week from the current week', () => {
    expect(neighbouringWeeks(THIS_MONDAY, TODAY)).toEqual({
      previous: '2026-09-28',
      next: '2026-10-12',
    });
  });

  it('gives no next week beyond the next one', () => {
    expect(neighbouringWeeks('2026-10-12', TODAY)).toEqual({
      previous: '2026-10-05',
      next: null,
    });
  });

  it('gives no previous week at the tenth week back', () => {
    expect(neighbouringWeeks('2026-07-27', TODAY)).toEqual({
      previous: null,
      next: '2026-08-03',
    });
  });

  it('gives the previous week over an empty week inside the window', () => {
    expect(neighbouringWeeks('2026-08-03', TODAY)).toEqual({
      previous: '2026-07-27',
      next: '2026-08-10',
    });
  });
});
