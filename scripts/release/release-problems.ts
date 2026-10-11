// Why a release must not go ahead (MF-26 design D7). Pure: index.ts reads the state from git and GitHub.

/** A GitHub check run of the commit being released, as the API returns it. */
export type CheckRun = { name: string; status: string; conclusion: string | null };

/** What the release needs to know about the last commit of main and the remote. */
export type ReleaseState = {
  tag: string;
  tagExists: boolean;
  productionIsBehindMain: boolean;
  checkRuns: CheckRun[];
};

// The Deployment Checks that run on main; `release` runs after the push to production (MF-26 design D4).
const REQUIRED_CHECKS = ['checks', 'e2e'];

/**
 * Every reason not to release the last commit of main, empty when it can go to production.
 * @param state - The tag, the remote branches and the check runs of the commit.
 * @returns One message per problem.
 */
export function releaseProblems(state: ReleaseState): string[] {
  return [...tagProblems(state), ...branchProblems(state), ...REQUIRED_CHECKS.flatMap((name) => checkProblems(name, state.checkRuns))];
}

function tagProblems({ tag, tagExists }: ReleaseState) {
  return tagExists ? [`The tag ${tag} already exists: bump "version" in package.json in a PR before releasing`] : [];
}

function branchProblems({ productionIsBehindMain }: ReleaseState) {
  return productionIsBehindMain ? [] : ['production has commits that are not in main: it must only move forward to commits of main'];
}

function checkProblems(name: string, checkRuns: CheckRun[]) {
  const run = checkRuns.find((checkRun) => checkRun.name === name);
  if (!run) return [`${name} has not run on the last commit of main`];
  if (run.status !== 'completed') return [`${name} is still running on the last commit of main`];
  if (run.conclusion !== 'success') return [`${name} ended in ${run.conclusion} on the last commit of main`];
  return [];
}
