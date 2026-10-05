import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { themeDrift } from './generate-theme';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const snapshot: unknown = JSON.parse(read('design-system/tokens.json'));
const version = read('design-system/VERSION').trim();
const committedTheme = () => (existsSync(new URL('../../src/app/theme.css', import.meta.url)) ? read('src/app/theme.css') : '');

describe('committed theme', () => {
  it('is what the committed snapshot generates', () => {
    expect(themeDrift(committedTheme(), snapshot, version)).toBeNull();
  });

  it('is caught when edited by hand', () => {
    const edited = committedTheme().replace('--color-ink: #171a0b;', '--color-ink: #000000;');

    expect(themeDrift(edited, snapshot, version)).toBe(
      'src/app/theme.css does not match design-system/tokens.json: run pnpm ds:tokens',
    );
  });
});
