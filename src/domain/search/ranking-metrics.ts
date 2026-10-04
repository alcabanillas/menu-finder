import { comparableScore } from '@/domain/search/rank-menus';

/** A menu of a ranking, in order, with the score that placed it there. */
export type RankedMenu = { menu: number; score: number };

/** The grade (0, 1 or 2) of each menu for one query; a menu without a grade counts as 0. */
export type Grades = ReadonlyMap<number, number>;

/** A run of menus with equal scores, and the position of its first menu (0-based). */
type TiedGroup = { start: number; grades: number[] };

const CUTOFF = 5;
const RELEVANT = 2;

/**
 * nDCG@5 with each grade as its gain and a base-2 logarithmic discount, against the ideal order of all the grades
 * (spec search-evaluation, "Metrics"). Every position held by a tie gets the mean grade of the whole tie, because the
 * order inside a tie is the menu number and says nothing about the strategy (design D3). Null when every grade is 0.
 */
export function ndcgAt5(ranking: RankedMenu[], grades: Grades): number | null {
  const ideal = idealGain(grades);
  if (ideal === 0) return null;
  return discountedGain(ranking, grades) / ideal;
}

/**
 * The chance that the top five hold a menu of grade 2 when the order inside each tie is random: 1 without a tie,
 * `1 − C(g − r, k) / C(g, k)` for a tie of `g` menus, `r` of grade 2, that crosses the cut with `k` places left.
 * Null when no menu has grade 2.
 */
export function hitAt5(ranking: RankedMenu[], grades: Grades): number | null {
  if (![...grades.values()].includes(RELEVANT)) return null;
  const missProbability = groupsInTop(ranking, grades).reduce((miss, group) => miss * groupMiss(group), 1);
  return 1 - missProbability;
}

function idealGain(grades: Grades): number {
  const best = [...grades.values()].sort((a, b) => b - a).slice(0, CUTOFF);
  return best.reduce((sum, grade, position) => sum + discounted(grade, position), 0);
}

function discountedGain(ranking: RankedMenu[], grades: Grades): number {
  let sum = 0;
  for (const group of groupsInTop(ranking, grades)) {
    const gain = mean(group.grades);
    for (let position = group.start; position < placesEnd(group); position += 1) sum += discounted(gain, position);
  }
  return sum;
}

// The tied groups that start inside the top five, each with the grades of all its members.
function groupsInTop(ranking: RankedMenu[], grades: Grades): TiedGroup[] {
  const groups: TiedGroup[] = [];
  for (const [position, { menu, score }] of ranking.entries()) {
    const previous = ranking[position - 1];
    const grade = grades.get(menu) ?? 0;
    if (previous && comparableScore(previous.score) === comparableScore(score)) groups.at(-1)!.grades.push(grade);
    else if (position < CUTOFF) groups.push({ start: position, grades: [grade] });
    else break;
  }
  return groups;
}

// The chance that none of the places of the top five held by this group goes to a grade-2 menu.
function groupMiss(group: TiedGroup): number {
  const places = placesEnd(group) - group.start;
  const relevant = group.grades.filter((grade) => grade === RELEVANT).length;
  return combinations(group.grades.length - relevant, places) / combinations(group.grades.length, places);
}

function placesEnd({ start, grades }: TiedGroup): number {
  return Math.min(start + grades.length, CUTOFF);
}

function discounted(gain: number, position: number): number {
  return gain / Math.log2(position + 2);
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function combinations(n: number, k: number): number {
  if (k > n) return 0;
  let result = 1;
  for (let index = 0; index < k; index += 1) result = (result * (n - index)) / (index + 1);
  return result;
}
