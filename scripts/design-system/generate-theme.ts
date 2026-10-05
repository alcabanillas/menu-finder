// Turns the design system snapshot (design-system/tokens.json) into Tailwind v4 theme variables (MF-47.1).
// Pure: no IO, so the command (index.ts) and the coherence test share it.
// The snapshot comes from an artifact others could edit: every name and value is checked against an allow-list
// before it reaches a stylesheet every page loads (A03, A08).

import { z } from 'zod';
import { err, ok, type Result } from '@/shared/result';

/** A token of the snapshot that does not have the expected shape. */
export type TokenError = { section: string; token: string; message: string };

const TokenSchema = z.object({ name: z.string(), value: z.string() });
const GroupSchema = z.object({ tokens: z.array(TokenSchema) });
const TypeStyleSchema = z.object({
  name: z.string(),
  fontSize: z.string(),
  lineHeight: z.string().optional(),
  fontWeight: z.number().optional(),
  letterSpacing: z.string().optional(),
});
// Sections not listed here (and `type.families`, `color.themes`) are dropped by the parse: the generator ignores them.
const SnapshotSchema = z.object({
  color: GroupSchema.optional(),
  radius: GroupSchema.optional(),
  shadow: GroupSchema.optional(),
  spacing: GroupSchema.optional(),
  type: z.object({ groups: z.array(z.object({ styles: z.array(TypeStyleSchema) })) }).optional(),
});

type Token = z.infer<typeof TokenSchema>;
type TypeStyle = z.infer<typeof TypeStyleSchema>;
type Snapshot = z.infer<typeof SnapshotSchema>;

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HEX = /^#[0-9a-f]{3,8}$/i;
const ALIAS = /^\{([a-z0-9-]+)\}$/;
const LENGTH = /^(0|-?\d*\.?\d+(px|rem|em))$/;
const NUMBER = /^\d*\.?\d+$/;
const SHADOW_COLOR = String.raw`(rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d*\.?\d+\s*)?\)|#[0-9a-f]{3,8})`;
const SHADOW = new RegExp(String.raw`^((-?\d*\.?\d+(px|rem|em)?)\s+){2,4}${SHADOW_COLOR}$`, 'i');

// The snapshot names radii `radius-pill`; the theme namespace already says radius, so the prefix goes.
const PREFIXED_GROUPS = [
  { group: 'radius', namespace: 'radius', prefix: 'radius-', isValid: (value: string) => LENGTH.test(value) },
  { group: 'shadow', namespace: 'shadow', prefix: 'shadow-', isValid: isShadow },
  { group: 'spacing', namespace: 'spacing', prefix: 'space-', isValid: (value: string) => LENGTH.test(value) },
] as const;

/** The theme stylesheet for `snapshot`, or every token that does not have the expected shape. */
export function generateTheme(snapshot: unknown, version: string): Result<string, TokenError[]> {
  const parsed = SnapshotSchema.safeParse(snapshot);
  if (!parsed.success) return err(parsed.error.issues.map(toStructureError));

  const errors = validateSnapshot(parsed.data);
  return errors.length > 0 ? err(errors) : ok(renderTheme(parsed.data, version));
}

/** Why `committedTheme` is not what the snapshot generates, or null when it is. */
export function themeDrift(committedTheme: string, snapshot: unknown, version: string): string | null {
  const generated = generateTheme(snapshot, version);
  if (!generated.ok) return `design-system/tokens.json is invalid: ${JSON.stringify(generated.error)}`;
  return generated.value === committedTheme
    ? null
    : 'src/app/theme.css does not match design-system/tokens.json: run pnpm ds:tokens';
}

function toStructureError(issue: z.core.$ZodIssue): TokenError {
  return { section: String(issue.path[0] ?? 'snapshot'), token: issue.path.join('.'), message: issue.message };
}

function validateSnapshot(snapshot: Snapshot): TokenError[] {
  return [
    ...validateColors(snapshot.color?.tokens ?? []),
    ...PREFIXED_GROUPS.flatMap(({ group, isValid }) =>
      (snapshot[group]?.tokens ?? []).flatMap((token) => tokenErrors(group, token, isValid)),
    ),
    ...(snapshot.type?.groups ?? []).flatMap(({ styles }) => styles.flatMap(typeStyleErrors)),
  ];
}

function validateColors(tokens: Token[]): TokenError[] {
  const defined = new Set(tokens.map(({ name }) => name));
  const isColor = (value: string) => HEX.test(value) || defined.has(ALIAS.exec(value)?.[1] ?? '');
  return tokens.flatMap((token) => tokenErrors('color', token, isColor));
}

function tokenErrors(section: string, { name, value }: Token, isValid: (value: string) => boolean): TokenError[] {
  if (!NAME.test(name)) return [{ section, token: name, message: 'the name is not kebab-case' }];
  if (!isValid(value)) return [{ section, token: name, message: `the value ${JSON.stringify(value)} is not allowed` }];
  return [];
}

function isShadow(value: string): boolean {
  return value === 'none' || SHADOW.test(value);
}

function typeStyleErrors({ name, fontSize, lineHeight, fontWeight, letterSpacing }: TypeStyle): TokenError[] {
  const valid =
    NAME.test(name) &&
    LENGTH.test(fontSize) &&
    (lineHeight === undefined || NUMBER.test(lineHeight)) &&
    (fontWeight === undefined || (Number.isInteger(fontWeight) && fontWeight >= 100 && fontWeight <= 900)) &&
    (letterSpacing === undefined || LENGTH.test(letterSpacing));
  return valid ? [] : [{ section: 'type', token: name, message: 'a name or a value of the style is not allowed' }];
}

function renderTheme(snapshot: Snapshot, version: string): string {
  const lines = [
    header(version),
    '@theme {',
    '  --color-*: initial;',
    ...colorLines(snapshot.color?.tokens ?? []),
    ...PREFIXED_GROUPS.flatMap(({ group, namespace, prefix }) =>
      prefixedLines(snapshot[group]?.tokens ?? [], namespace, prefix),
    ),
    ...(snapshot.type?.groups ?? []).flatMap(({ styles }) => styles.flatMap(typeStyleLines)),
    '}',
  ];
  return `${lines.join('\n')}\n`;
}

function header(version: string): string {
  return `/* Generated by \`pnpm ds:tokens\` from design-system/tokens.json. Do not edit by hand. Design system version ${version}. */`;
}

function colorLines(tokens: Token[]): string[] {
  return tokens.map(({ name, value }) => `  --color-${name}: ${colorValue(value)};`);
}

function colorValue(value: string): string {
  const alias = ALIAS.exec(value);
  return alias ? `var(--color-${alias[1]})` : value;
}

function prefixedLines(tokens: Token[], namespace: string, prefix: string): string[] {
  return tokens.map(({ name, value }) => `  --${namespace}-${withoutPrefix(name, prefix)}: ${value};`);
}

function withoutPrefix(name: string, prefix: string): string {
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function typeStyleLines({ name, fontSize, lineHeight, fontWeight, letterSpacing }: TypeStyle): string[] {
  const properties = [
    ['line-height', lineHeight],
    ['font-weight', fontWeight],
    ['letter-spacing', letterSpacing],
  ] as const;
  return [
    `  --text-${name}: ${fontSize};`,
    ...properties
      .filter(([, value]) => value !== undefined)
      .map(([property, value]) => `  --text-${name}--${property}: ${value};`),
  ];
}
