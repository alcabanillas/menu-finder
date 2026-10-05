import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// Runs the real `pnpm ds:tokens` shell in a throwaway directory: it resolves its paths from the working directory.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const PREVIOUS_THEME = '/* the theme before the run */\n';

let workdir: string;

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'ds-tokens-'));
  cpSync(join(repo, 'design-system'), join(workdir, 'design-system'), { recursive: true });
  mkdirSync(join(workdir, 'src/app'), { recursive: true });
  writeFileSync(join(workdir, 'src/app/theme.css'), PREVIOUS_THEME);
});

afterEach(() => rmSync(workdir, { recursive: true, force: true }));

describe('pnpm ds:tokens', () => {
  it('fails, names the token and leaves the theme unchanged when a value is not allowed', () => {
    tamperColor('ink', 'red;} body{background:url(https://evil.example)');

    const run = runCommand();

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain('color/ink');
    expect(readFileSync(join(workdir, 'src/app/theme.css'), 'utf8')).toBe(PREVIOUS_THEME);
  });

  it('writes the theme when the snapshot is valid', () => {
    const run = runCommand();

    expect(run.status).toBe(0);
    expect(readFileSync(join(workdir, 'src/app/theme.css'), 'utf8')).toBe(readFileSync(join(repo, 'src/app/theme.css'), 'utf8'));
  });
});

function tamperColor(name: string, value: string) {
  const path = join(workdir, 'design-system/tokens.json');
  const snapshot = JSON.parse(readFileSync(path, 'utf8'));
  snapshot.color.tokens.find((token: { name: string }) => token.name === name).value = value;
  writeFileSync(path, JSON.stringify(snapshot));
}

function runCommand() {
  const tsx = join(repo, 'node_modules/tsx/dist/cli.mjs');
  const args = [tsx, '--tsconfig', join(repo, 'tsconfig.json'), join(repo, 'scripts/design-system/index.ts')];
  return spawnSync(process.execPath, args, { cwd: workdir, encoding: 'utf8' });
}
