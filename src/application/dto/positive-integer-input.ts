import { z } from 'zod';

const positiveSafeInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

// A form sends strings: only digits are accepted, so "12abc" and "1.5" are refused instead of half-parsed.
export const positiveIntegerInput = z.union([
  positiveSafeInteger,
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(positiveSafeInteger),
]);
