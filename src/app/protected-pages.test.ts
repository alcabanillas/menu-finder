import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Every route other than these is protected (spec authentication, "Protected routes require a session checked on the
// server"). A rule nobody checks gets broken, so this test reads every page and looks for the check (design D6).
const PUBLIC_PAGES = ['page.tsx', join('login', 'page.tsx')];
const APP_DIR = join(process.cwd(), 'src', 'app');

describe('protected pages', () => {
  it('has at least one protected page to check', () => {
    expect(protectedPages().length).toBeGreaterThan(0);
  });

  it.each(protectedPages())('%s checks the session with requireUser before anything else', (page) => {
    const source = readFileSync(join(APP_DIR, page), 'utf8');

    expect(source).toMatch(/await requireUser\(\)/);
  });
});

function protectedPages(): string[] {
  return pagesUnder(APP_DIR).filter((page) => !PUBLIC_PAGES.includes(page));
}

function pagesUnder(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.split(sep).at(-1) === 'page.tsx')
    .map((path) => relative(APP_DIR, join(dir, path)));
}
