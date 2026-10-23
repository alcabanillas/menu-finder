// pnpm welcome:check-samples: fails if a sample dish of the visitor's home is a dish or a recipe of the local catalogue
// (MF-76 design D4, SEG-datos-nutricionista). It reads data/, which is never committed, so it runs by hand, not in CI.
// Thin shell: reads and sets the exit code; the logic lives in catalogue-matches.ts.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SAMPLE_DISHES } from '../../src/app/_welcome/sample-data';
import { catalogueMatches, catalogueNames } from './catalogue-matches';

const menusPath = resolve('data/menu-platos.json');
const recipesPath = resolve('data/recetas.json');

function main() {
  if (!existsSync(menusPath) || !existsSync(recipesPath)) return fail(`Missing ${menusPath} or ${recipesPath}: run the T0 runbook first.`);

  const names = catalogueNames(JSON.parse(readFileSync(menusPath, 'utf8')), JSON.parse(readFileSync(recipesPath, 'utf8')));
  const matches = catalogueMatches(SAMPLE_DISHES, names);
  if (matches.length > 0) return fail(`Sample dishes found in the catalogue: ${matches.join(', ')}`);

  console.log(`${SAMPLE_DISHES.length} sample dishes checked against ${names.size} catalogue names: none matches.`);
}

function fail(message: string) {
  console.error(message);
  process.exitCode = 1;
}

main();
