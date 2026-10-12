/** The menu numbers and recipe keys one run of a spec file seeds, so no other run touches them (MF-62 design D1). */
export type FixtureRun = { menuNumber: (offset: number) => number; key: (name: string) => string };

// Far above the real menus (1 to 36) and the old fixed fixtures; low enough that base + offset fits a PostgreSQL
// `integer` (MF-62 design D2).
const FIRST_BASE = 1_000_000;
const LAST_BASE = 2_000_000_000;

/**
 * A random base for this run: its menus are `base + offset` and its recipe keys end in `-<base>`. Call it once at the
 * top level of a spec file, next to `registerTestAccount()`, so each worker gets its own.
 */
export function newFixtureRun(random: () => number = Math.random): FixtureRun {
  const base = FIRST_BASE + Math.floor(random() * (LAST_BASE - FIRST_BASE));
  return { menuNumber: (offset) => base + offset, key: (name) => `${name}-${base}` };
}
