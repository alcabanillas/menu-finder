// pnpm roadmap [path]: generates reports/roadmap.html from context/roadmap.md (MF-39).
// Thin shell: reads, writes and sets the exit code; the logic lives in the pure modules.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseRoadmap } from './parse-roadmap';
import { renderHtml } from './render-html';
import { summarize } from './summarize';
import type { RoadmapError } from './types';

const source = resolve(process.argv[2] ?? 'context/roadmap.md');
const output = resolve('reports/roadmap.html');

const localToday = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const fail = (errors: RoadmapError[]) => {
  for (const error of errors) {
    console.error(error.line === undefined ? error.message : `${source}:${error.line}: ${error.message}`);
  }
  process.exitCode = 1;
};

function main() {
  if (!existsSync(source)) return fail([{ message: `roadmap not found: ${source}` }]);

  const parsed = parseRoadmap(readFileSync(source, 'utf8'));
  if (!parsed.ok) return fail(parsed.errors);

  const summarized = summarize(parsed.roadmap, localToday());
  if (!summarized.ok) return fail(summarized.errors);

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, renderHtml(summarized.summary), 'utf8');
  console.log(`Dashboard written to ${output}`);
}

main();
