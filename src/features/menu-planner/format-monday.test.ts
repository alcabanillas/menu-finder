import { describe, expect, it } from 'vitest';
import { formatMonday } from '@/features/menu-planner/format-monday';

describe('formatMonday', () => {
  it.each([
    ['2026-10-05', 'lunes 5 de octubre'],
    ['2026-12-28', 'lunes 28 de diciembre'],
  ])('writes %s as "%s", without the comma', (date, text) => {
    expect(formatMonday(date)).toBe(text);
  });
});
