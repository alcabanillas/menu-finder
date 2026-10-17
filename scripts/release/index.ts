// pnpm release: publishes the last commit of main to production (MF-26 design D7, context/despliegue.md).
// Thin shell: reads the state from git and GitHub, asks before acting and pushes; the checks live in release-problems.ts.

import { spawnSync } from 'node:child_process';
import { stdin, stdout } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { publishSteps } from './publish-steps';
import { releaseProblems, type CheckRun, type ReleaseState } from './release-problems';

const MIGRATIONS = 'postgres/migrations';

async function main() {
  run('git', ['fetch', '--quiet', '--tags', 'origin', 'main', 'production']);
  const commit = run('git', ['rev-parse', 'origin/main']);
  const state = readState(commit);

  const problems = releaseProblems(state);
  if (problems.length > 0) return fail(problems);

  const migrations = changedMigrations(commit);
  if (migrations.length > 0 && !(await confirmMigrations(migrations))) return cancel();
  if (!(await confirm(`Release ${state.tag} (${commit.slice(0, 7)}) to production?`))) return cancel();

  publish(state.tag, commit);
}

function readState(commit: string): ReleaseState {
  const tag = `v${JSON.parse(run('git', ['show', `${commit}:package.json`])).version}`;
  return {
    tag,
    tagExists: succeeds('git', ['rev-parse', '--quiet', '--verify', `refs/tags/${tag}`]),
    productionIsBehindMain: succeeds('git', ['merge-base', '--is-ancestor', 'origin/production', commit]),
    checkRuns: checkRuns(commit),
  };
}

function checkRuns(commit: string): CheckRun[] {
  const response = JSON.parse(run('gh', ['api', `repos/{owner}/{repo}/commits/${commit}/check-runs?per_page=100`]));
  return response.check_runs;
}

function fail(problems: string[]) {
  for (const problem of problems) console.error(`✗ ${problem}`);
  console.error('Nothing was released.');
  process.exitCode = 1;
}

// Migrations are applied by hand to the production branch of Neon before the code that needs them (OPS-ramas-bd).
function changedMigrations(commit: string) {
  const previous = spawnSync('git', ['describe', '--tags', '--abbrev=0', '--match', 'v*', commit], { encoding: 'utf8' });
  const since = previous.status === 0 ? [previous.stdout.trim()] : [];
  const files = run('git', ['diff', '--name-only', ...since, commit, '--', MIGRATIONS]);
  return files ? files.split('\n') : [];
}

async function confirmMigrations(migrations: string[]) {
  console.log(`Migrations changed since the last release:\n${migrations.map((file) => `  ${file}`).join('\n')}`);
  return confirm('Are they applied to the production branch of Neon (pnpm ingest migrate)?');
}

async function confirm(question: string) {
  const prompt = createInterface({ input: stdin, output: stdout });
  const answer = await prompt.question(`${question} (y/N) `);
  prompt.close();
  return answer.trim().toLowerCase() === 'y';
}

function cancel() {
  console.log('Cancelled. Nothing was released.');
}

// Each step says what it does before it runs, and its output reaches the terminal.
function publish(tag: string, commit: string) {
  for (const step of publishSteps(tag, commit)) {
    console.log(step.label);
    runVisibly(step.command, step.args);
  }
  console.log(`✓ ${tag} pushed and production moved to ${commit.slice(0, 7)}.`);
  console.log('Vercel builds it and promotes it once the release check passes: gh run list --workflow release.yml');
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed:\n${result.stderr || result.error}`);
  return result.stdout.trim();
}

function runVisibly(command: string, args: string[]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed${result.error ? `: ${result.error}` : ''}`);
}

function succeeds(command: string, args: string[]) {
  return spawnSync(command, args, { encoding: 'utf8' }).status === 0;
}

void main();
