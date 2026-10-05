import { describe, expect, it } from 'vitest';
import { generateTheme, type TokenError } from './generate-theme';

const VERSION = '1791096508-606b';

const snapshotWith = (sections: Record<string, unknown>) => ({ name: 'Test', version: 1, ...sections });
const colors = (...tokens: { name: string; value: string }[]) => ({ color: { themes: [], tokens } });

const themeOf = (snapshot: unknown): string => {
  const result = generateTheme(snapshot, VERSION);
  if (!result.ok) throw new Error(`expected a theme, got ${JSON.stringify(result.error)}`);
  return result.value;
};

describe('generateTheme: colours', () => {
  it('turns a colour token into a colour variable', () => {
    const theme = themeOf(snapshotWith(colors({ name: 'olive-600', value: '#4d6a0b' })));

    expect(theme).toContain('  --color-olive-600: #4d6a0b;\n');
  });

  it('makes an alias refer to the aliased colour', () => {
    const theme = themeOf(snapshotWith(colors({ name: 'ink', value: '#171a0b' }, { name: 'text-strong', value: '{ink}' })));

    expect(theme).toContain('  --color-text-strong: var(--color-ink);\n');
  });

  it('resets the default palette before the design system colours', () => {
    const theme = themeOf(snapshotWith(colors({ name: 'ink', value: '#171a0b' })));

    expect(theme.indexOf('--color-*: initial;')).toBeGreaterThan(-1);
    expect(theme.indexOf('--color-*: initial;')).toBeLessThan(theme.indexOf('--color-ink'));
  });
});

describe('generateTheme: radius, shadow and spacing', () => {
  it('turns each token into its theme variable', () => {
    const theme = themeOf(
      snapshotWith({
        radius: { tokens: [{ name: 'radius-pill', value: '999px' }] },
        shadow: { tokens: [{ name: 'shadow-raised', value: '0 2px 12px -4px rgba(0,0,0,.12)' }] },
        spacing: {
          tokens: [
            { name: 'space-5', value: '20px' },
            { name: 'content-max', value: '440px' },
          ],
        },
      }),
    );

    expect(theme).toContain('  --radius-pill: 999px;\n');
    expect(theme).toContain('  --shadow-raised: 0 2px 12px -4px rgba(0,0,0,.12);\n');
    expect(theme).toContain('  --spacing-5: 20px;\n');
    expect(theme).toContain('  --spacing-content-max: 440px;\n');
  });
});

describe('generateTheme: type styles', () => {
  it('turns a type style into a font size with its properties', () => {
    const h1 = { name: 'h1', fontSize: '34px', lineHeight: '1.1', fontWeight: 800, letterSpacing: '-0.02em' };
    const theme = themeOf(snapshotWith({ type: { fonts: [], families: {}, groups: [{ name: 'Display', family: 'display', styles: [h1] }] } }));

    expect(theme).toContain(
      [
        '  --text-h1: 34px;',
        '  --text-h1--line-height: 1.1;',
        '  --text-h1--font-weight: 800;',
        '  --text-h1--letter-spacing: -0.02em;',
      ].join('\n'),
    );
  });

  it('leaves out the properties a style does not give', () => {
    const eyebrow = { name: 'eyebrow', fontSize: '11px', fontWeight: 600 };
    const theme = themeOf(snapshotWith({ type: { fonts: [], families: {}, groups: [{ name: 'Text', family: 'body', styles: [eyebrow] }] } }));

    expect(theme).toContain('  --text-eyebrow: 11px;\n  --text-eyebrow--font-weight: 600;\n');
    expect(theme).not.toContain('--text-eyebrow--line-height');
  });
});

describe('generateTheme: validation', () => {
  const errorsOf = (snapshot: unknown): TokenError[] => {
    const result = generateTheme(snapshot, VERSION);
    if (result.ok) throw new Error('expected errors, got a theme');
    return result.error;
  };
  const tokensNamed = (errors: TokenError[]) => errors.map(({ section, token }) => `${section}/${token}`);

  it('rejects a colour value that is not a colour', () => {
    const errors = errorsOf(snapshotWith(colors({ name: 'ink', value: 'red;} body{background:url(https://evil.example)' })));

    expect(tokensNamed(errors)).toEqual(['color/ink']);
  });

  it('rejects an alias to a colour that does not exist', () => {
    const errors = errorsOf(snapshotWith(colors({ name: 'text-strong', value: '{missing}' })));

    expect(tokensNamed(errors)).toEqual(['color/text-strong']);
  });

  it('rejects a name that is not kebab-case', () => {
    const errors = errorsOf(snapshotWith({ radius: { tokens: [{ name: 'pill}', value: '999px' }] } }));

    expect(tokensNamed(errors)).toEqual(['radius/pill}']);
  });

  it('rejects a shadow with a url', () => {
    const errors = errorsOf(snapshotWith({ shadow: { tokens: [{ name: 'shadow-raised', value: '0 0 url(https://evil.example)' }] } }));

    expect(tokensNamed(errors)).toEqual(['shadow/shadow-raised']);
  });

  it('rejects a type style with a font size that is not a length', () => {
    const style = { name: 'h1', fontSize: 'calc(1px);}', fontWeight: 800 };
    const errors = errorsOf(snapshotWith({ type: { fonts: [], families: {}, groups: [{ name: 'Display', styles: [style] }] } }));

    expect(tokensNamed(errors)).toEqual(['type/h1']);
  });

  it('reports every invalid token, not only the first', () => {
    const errors = errorsOf(
      snapshotWith({ ...colors({ name: 'ink', value: 'nope' }), radius: { tokens: [{ name: 'radius-md', value: '10' }] } }),
    );

    expect(tokensNamed(errors)).toEqual(['color/ink', 'radius/radius-md']);
  });
});

describe('generateTheme: unknown sections', () => {
  it('ignores a section it does not know', () => {
    const theme = themeOf(snapshotWith({ ...colors({ name: 'ink', value: '#171a0b' }), motion: { tokens: [{ name: 'ease-out', value: 'url(x)' }] } }));

    expect(theme).not.toContain('ease-out');
    expect(theme).not.toContain('url(');
  });
});

describe('generateTheme: header', () => {
  it('names the command and the design system version it comes from', () => {
    const theme = themeOf(snapshotWith({}));

    expect(theme.startsWith('/* Generated by `pnpm ds:tokens` from design-system/tokens.json')).toBe(true);
    expect(theme.split('\n')[0]).toContain('Do not edit by hand.');
    expect(theme.split('\n')[0]).toContain(`Design system version ${VERSION}.`);
  });
});
