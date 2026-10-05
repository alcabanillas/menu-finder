// pnpm ds:tokens: generates src/app/theme.css from the design system snapshot in design-system/ (MF-47.1).
// Thin shell: reads, writes and sets the exit code; the logic lives in generate-theme.ts.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateTheme, type TokenError } from './generate-theme';

const snapshotPath = resolve('design-system/tokens.json');
const versionPath = resolve('design-system/VERSION');
const themePath = resolve('src/app/theme.css');

function main() {
  const snapshot: unknown = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const version = readFileSync(versionPath, 'utf8').trim();

  const theme = generateTheme(snapshot, version);
  if (!theme.ok) return fail(theme.error);

  writeFileSync(themePath, theme.value, 'utf8');
  console.log(`Theme written to ${themePath} (design system version ${version})`);
}

function fail(errors: TokenError[]) {
  for (const { section, token, message } of errors) console.error(`${snapshotPath}: ${section}/${token}: ${message}`);
  console.error('Nothing was written.');
  process.exitCode = 1;
}

main();
