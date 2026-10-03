// Generic fillers the nutritionist adds to many meals; unmarked, they are not dishes.
const FILLER_PATTERNS = [
  /^una pieza de fruta( \(no zumo\))?\.?$/i,
  /^(un\s+)?yogur(\s*\/\s*k[eé]fir)?\s+sin\s+az[uú]car(es)?\s+a[ñn]adidos?\.?$/i,
];

/** Whether a dish text is a generic filler (a piece of fruit, a sugar-free yogurt) rather than a dish. */
export const isFiller = (text: string): boolean => FILLER_PATTERNS.some((pattern) => pattern.test(text.trim()));
