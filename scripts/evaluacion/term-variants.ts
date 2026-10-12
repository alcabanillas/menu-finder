// pnpm evals:term-variants: does the search rank the same menus when a term changes form (MF-40.2)?
// Runs the real search with pairs of variants of one term ("rápidas" / "rápido") and compares the five best menus
// of each strategy. Read only: it queries the database and embeds the terms with Gemini.

import { resolve } from 'node:path';
import type { SearchRequestDto } from '@/application/dto/search-request';
import type { SearchStrategy } from '@/application/dto/search-result';
import { createCliContainer } from '@/composition/cli-container';

type ConstraintType = SearchRequestDto['constraints'][number]['type'];

type VariantGroup = { type: ConstraintType; slot?: 'lunch' | 'dinner'; terms: string[] };

const STRATEGIES: SearchStrategy[] = ['lexical', 'semantic', 'hybrid'];

// The first term of each group is the one labelled in evals/decomposer/golden-set.json; the others are forms a
// model could return instead: gender and number, a missing accent, a shorter cut, a broader word.
const GROUPS: VariantGroup[] = [
  { type: 'attribute', slot: 'dinner', terms: ['rápidas', 'rápido', 'rapidas'] },
  { type: 'literal', terms: ['huevos', 'huevo'] },
  { type: 'literal', terms: ['salmón', 'salmon'] },
  { type: 'literal', terms: ['alitas de pollo', 'alitas', 'pollo'] },
  { type: 'fuzzy', terms: ['de cuchara', 'cuchara'] },
  { type: 'fuzzy', terms: ['ligeras', 'ligero'] },
];

async function main() {
  process.loadEnvFile(resolve('.env.local'));
  const container = createCliContainer(process.env);
  for (const group of GROUPS) {
    console.log(`\n${group.type}${group.slot ? ` (${group.slot})` : ''}: ${group.terms.join(' / ')}`);
    for (const strategy of STRATEGIES) {
      const tops = [];
      for (const term of group.terms) tops.push(await topMenus(container, group, term, strategy));
      printComparison(strategy, group.terms, tops);
    }
  }
}

async function topMenus(
  container: ReturnType<typeof createCliContainer>,
  { type, slot }: VariantGroup,
  term: string,
  strategy: SearchStrategy,
): Promise<number[]> {
  const constraint = { id: 'c1', type, term, polarity: 'include' as const, hard: false, ...(slot ? { slot } : {}) };
  const result = await container.searchMenus({ constraints: [constraint] }, strategy);
  if (!result.ok) throw new Error(`search failed for "${term}" (${strategy}): ${JSON.stringify(result.error)}`);
  return result.value.menus.map(({ menu }) => menu);
}

// Each variant against the first (golden-set) term: its top five and how many menus they share.
function printComparison(strategy: SearchStrategy, terms: string[], tops: number[][]) {
  const [reference] = tops;
  terms.forEach((term, index) => {
    const shared = tops[index].filter((menu) => reference.includes(menu)).length;
    const overlap = index === 0 ? '' : `  shared with "${terms[0]}": ${shared}/${Math.max(reference.length, tops[index].length)}`;
    console.log(`  ${strategy.padEnd(8)} ${term.padEnd(16)} [${tops[index].join(', ')}]${overlap}`);
  });
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
