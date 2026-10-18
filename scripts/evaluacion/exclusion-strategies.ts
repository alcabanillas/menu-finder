// tsx scripts/evaluacion/exclusion-strategies.ts: for each excluded term, which dishes "contain" it with the lexical
// strategy and with the semantic one (rescaled score at the matching threshold), and how many menus would survive a
// week-wide filter with each. Read only: it embeds the terms with Gemini and queries the database. Dish names are
// printed to the console only, never written to a file (SEG-datos-nutricionista).

import { resolve } from 'node:path';
import pg from 'pg';
import { EMBEDDING_VARIANT } from '@/domain/search/embedding-text';
import { matchesTerm, rescaleSimilarities } from '@/domain/search/term-score';
import { createGenkitEmbeddings } from '@/infrastructure/genkit/genkit-embeddings';
import { PostgresDishTextSearch } from '@/infrastructure/postgres/postgres-dish-text-search';
import { PostgresMenuRepository } from '@/infrastructure/postgres/postgres-menu-repository';
import { PostgresRecipeEmbeddingRepository } from '@/infrastructure/postgres/postgres-recipe-embedding-repository';

type Address = { menu: number; day: string; meal: string; position: number };
type TermReport = { term: string; lexical: Set<string>; semantic: Set<string> };

// The exclusion terms of the decomposer golden set (E01–E07), then terms that test both sides of the trade-off: words
// a lexical match misses (cerdo → jamón) and terms no dish has.
const TERMS = [
  'pescado crudo',
  'pollo',
  'cerdo',
  'pescado',
  'marisco',
  'carne roja',
  'queso',
  'vegetariano',
  'huevo',
  'gluten',
  'lactosa',
  'jamón',
  'caviar',
  'kebab',
];
const SAMPLE = 6;

async function main() {
  process.loadEnvFile(resolve('.env.local'));
  const url = process.env.DATABASE_URL_UNPOOLED;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!url || !apiKey) throw new Error('DATABASE_URL_UNPOOLED and GEMINI_API_KEY must be set in .env.local');
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    const names = await dishNames(pool);
    const reports = await measure(pool, apiKey);
    reports.forEach((report) => printReport(report, names));
  } finally {
    await pool.end();
  }
}

async function dishNames(pool: pg.Pool): Promise<Map<string, string>> {
  const menus = await new PostgresMenuRepository(pool).list();
  if (!menus.ok) throw new Error(menus.error.reason);
  const names = new Map<string, string>();
  for (const { number, meals } of menus.value) {
    for (const { day, type, dishes } of meals) {
      for (const { position, name } of dishes) names.set(key({ menu: number, day, meal: type, position }), name);
    }
  }
  return names;
}

async function measure(pool: pg.Pool, apiKey: string): Promise<TermReport[]> {
  const vectors = await createGenkitEmbeddings(apiKey).embedQueries(TERMS);
  if (!vectors.ok) throw new Error(vectors.error.reason);
  const store = new PostgresRecipeEmbeddingRepository(pool);
  const text = new PostgresDishTextSearch(pool);
  const reports: TermReport[] = [];
  for (const [index, term] of TERMS.entries()) {
    const similarities = await store.similarities(EMBEDDING_VARIANT, vectors.value[index]);
    const matches = await text.matches(term);
    if (!similarities.ok || !matches.ok) throw new Error(`query failed for "${term}"`);
    const rescaled = rescaleSimilarities(similarities.value.map(({ similarity }) => similarity));
    const semantic = similarities.value.filter((_, at) => matchesTerm(rescaled[at], 'semantic')).map(({ dish }) => key(dish));
    reports.push({ term, lexical: new Set(matches.value.map(key)), semantic: new Set(semantic) });
  }
  return reports;
}

function printReport({ term, lexical, semantic }: TermReport, names: Map<string, string>) {
  const menus = new Set([...names.keys()].map(menuOf));
  console.log(`\n== ${term}`);
  console.log(`  dishes containing it: lexical ${lexical.size}, semantic ${semantic.size}`);
  console.log(`  menus a week-wide filter keeps: lexical ${cleanMenus(menus, lexical)}, semantic ${cleanMenus(menus, semantic)} (of ${menus.size})`);
  console.log(`  only semantic: ${sample(difference(semantic, lexical), names)}`);
  console.log(`  only lexical: ${sample(difference(lexical, semantic), names)}`);
}

function cleanMenus(menus: Set<number>, dishes: Set<string>): number {
  const dirty = new Set([...dishes].map(menuOf));
  return [...menus].filter((menu) => !dirty.has(menu)).length;
}

function difference(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((item) => !b.has(item));
}

function sample(keys: string[], names: Map<string, string>): string {
  const distinct = [...new Set(keys.map((item) => names.get(item) ?? item))];
  const shown = distinct.slice(0, SAMPLE).join(' | ');
  return distinct.length > SAMPLE ? `${distinct.length} dishes, e.g. ${shown}` : `${distinct.length} ${shown}`;
}

function key({ menu, day, meal, position }: Address): string {
  return `${menu}/${day}/${meal}/${position}`;
}

function menuOf(dishKey: string): number {
  return Number(dishKey.split('/')[0]);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
