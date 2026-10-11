import { describe, expect, it } from 'vitest';
import { releaseProblems, type ReleaseState } from './release-problems';

const READY: ReleaseState = {
  tag: 'v0.2.0',
  tagExists: false,
  productionIsBehindMain: true,
  checkRuns: [
    { name: 'checks', status: 'completed', conclusion: 'success' },
    { name: 'e2e', status: 'completed', conclusion: 'success' },
  ],
};

describe('releaseProblems', () => {
  it('finds none when main is green, the tag is new and production is behind main', () => {
    expect(releaseProblems(READY)).toEqual([]);
  });

  it('refuses a version that was already released', () => {
    expect(releaseProblems({ ...READY, tagExists: true })).toEqual([
      'The tag v0.2.0 already exists: bump "version" in package.json in a PR before releasing',
    ]);
  });

  it('refuses when production has commits that are not in main', () => {
    expect(releaseProblems({ ...READY, productionIsBehindMain: false })).toEqual([
      'production has commits that are not in main: it must only move forward to commits of main',
    ]);
  });

  // A run cancelled by a later merge leaves no result, and Vercel would hold the deployment forever (MF-26 design D4).
  it('refuses when a check has not run on the commit', () => {
    const checkRuns = READY.checkRuns.filter(({ name }) => name !== 'e2e');

    expect(releaseProblems({ ...READY, checkRuns })).toEqual(['e2e has not run on the last commit of main']);
  });

  it('refuses while a check is still running', () => {
    const checkRuns = [READY.checkRuns[0], { name: 'e2e', status: 'in_progress', conclusion: null }];

    expect(releaseProblems({ ...READY, checkRuns })).toEqual(['e2e is still running on the last commit of main']);
  });

  it('refuses when a check did not pass', () => {
    const checkRuns = [{ name: 'checks', status: 'completed', conclusion: 'failure' }, READY.checkRuns[1]];

    expect(releaseProblems({ ...READY, checkRuns })).toEqual(['checks ended in failure on the last commit of main']);
  });

  it('ignores the other checks of the commit', () => {
    const checkRuns = [...READY.checkRuns, { name: 'scan / osv-scan', status: 'completed', conclusion: 'failure' }];

    expect(releaseProblems({ ...READY, checkRuns })).toEqual([]);
  });

  it('reports every problem at once', () => {
    expect(releaseProblems({ ...READY, tagExists: true, productionIsBehindMain: false, checkRuns: [] })).toHaveLength(4);
  });
});
