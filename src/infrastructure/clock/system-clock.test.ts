import { describe, expect, it } from 'vitest';
import { SystemClock } from '@/infrastructure/clock/system-clock';

const at = (iso: string) => () => new Date(iso);

describe('SystemClock', () => {
  it('Today is the date in Madrid: 00:30 of Monday in Madrid is still Sunday in UTC', () => {
    expect(new SystemClock(at('2026-10-11T22:30:00Z')).today()).toBe('2026-10-12');
  });

  it('uses summer time in July: 00:30 in Madrid is 22:30 UTC of the day before', () => {
    expect(new SystemClock(at('2026-07-01T22:30:00Z')).today()).toBe('2026-07-02');
  });

  it('gives the same day at noon', () => {
    expect(new SystemClock(at('2026-10-07T12:00:00Z')).today()).toBe('2026-10-07');
  });

  it('reads the real clock when no instant is given', () => {
    expect(new SystemClock().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
