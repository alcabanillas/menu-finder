// pnpm evals:similarity-floor: the best raw cosine similarity of each term, before rescaling (MF-42).
// Compares the terms of the decomposer golden set with control terms that are nowhere in the menus, to see whether
// one minimum similarity separates them. Read only: it embeds the terms with Gemini and queries the database.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { EMBEDDING_VARIANT } from '@/application/use-cases/embed-recipes';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';

type TermRow = { group: 'golden' | 'control'; term: string; lexicalMatches: number; bestSimilarity: number };

const GOLDEN_SET = resolve('evals/decomposer/golden-set.json');

// Food that makes sense but is not in the menus, then words that are not food at all. A control term that does
// match a dish by text is reported and left out of the summary.
const CONTROL_TERMS = [
  'caviar',
  'foie gras',
  'sushi',
  'kebab',
  'percebes',
  'ancas de rana',
  'jabalí',
  'canguro',
  'ordenador portátil',
  'neumático',
  'tornillo',
  'asdfgh',
  'qwerty zxcv',
  "x'); DROP TABLE menu_dish; --",
];

async function main() {
  process.loadEnvFile(resolve('.env.local'));
  const url = process.env.DATABASE_URL_UNPOOLED;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!url || !apiKey) throw new Error('DATABASE_URL_UNPOOLED and GEMINI_API_KEY must be set in .env.local');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    const rows = await measure(pool, apiKey, [...goldenTerms().map((term) => ['golden', term] as const), ...CONTROL_TERMS.map((term) => ['control', term] as const)]);
    printReport(rows);
  } finally {
    await pool.end();
  }
}

function goldenTerms(): string[] {
  const requests = JSON.parse(readFileSync(GOLDEN_SET, 'utf8')) as { constraints: { term: string }[] }[];
  return [...new Set(requests.flatMap(({ constraints }) => constraints.map(({ term }) => term.trim())))];
}

async function measure(pool: pg.Pool, apiKey: string, terms: (readonly [TermRow['group'], string])[]): Promise<TermRow[]> {
  const vectors = await createGenkitEmbeddings(apiKey).embedQueries(terms.map(([, term]) => term));
  if (!vectors.ok) throw new Error(vectors.error.reason);
  const store = new PostgresRecipeEmbeddingRepository(pool);
  const text = new PostgresDishTextSearch(pool);
  const rows: TermRow[] = [];
  for (const [index, [group, term]] of terms.entries()) {
    const similarities = await store.similarities(EMBEDDING_VARIANT, vectors.value[index]);
    const matches = await text.matches(term);
    if (!similarities.ok || !matches.ok) throw new Error(`query failed for "${term}"`);
    const bestSimilarity = Math.max(...similarities.value.map(({ similarity }) => similarity));
    rows.push({ group, term, lexicalMatches: matches.value.length, bestSimilarity });
  }
  return rows;
}

function printReport(rows: TermRow[]) {
  const golden = rows.filter((row) => row.group === 'golden');
  const controls = rows.filter((row) => row.group === 'control');
  console.log('Control terms (best similarity, high to low):');
  controls.toSorted(byBestDescending).forEach(printRow);
  console.log('\nGolden-set terms with no text match (best similarity, low to high):');
  golden.filter((row) => row.lexicalMatches === 0).toSorted(byBestAscending).forEach(printRow);
  console.log('\nGolden-set terms with a text match, the 10 lowest:');
  golden.filter((row) => row.lexicalMatches > 0).toSorted(byBestAscending).slice(0, 10).forEach(printRow);
  const absent = controls.filter((row) => row.lexicalMatches === 0);
  console.log(`\nHighest control (no text match): ${Math.max(...absent.map((row) => row.bestSimilarity)).toFixed(4)}`);
  console.log(`Lowest golden-set term: ${Math.min(...golden.map((row) => row.bestSimilarity)).toFixed(4)}`);
}

function byBestDescending(a: TermRow, b: TermRow) {
  return b.bestSimilarity - a.bestSimilarity;
}

function byBestAscending(a: TermRow, b: TermRow) {
  return a.bestSimilarity - b.bestSimilarity;
}

function printRow({ term, lexicalMatches, bestSimilarity }: TermRow) {
  console.log(`  ${bestSimilarity.toFixed(4)}  ${String(lexicalMatches).padStart(3)} text matches  ${term}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
