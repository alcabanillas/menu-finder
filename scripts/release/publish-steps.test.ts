import { describe, expect, it } from 'vitest';
import { publishSteps } from './publish-steps';

const COMMIT = 'd1bf6e98c10665d49480b862569fa436df7b0a21';

describe('publishSteps', () => {
  it('tags the commit, pushes the tag and moves production, in that order, each with a line that says what it does', () => {
    expect(publishSteps('v0.4.1', COMMIT)).toEqual([
      { label: 'Tagging d1bf6e9 as v0.4.1…', command: 'git', args: ['tag', 'v0.4.1', COMMIT] },
      { label: 'Pushing v0.4.1…', command: 'git', args: ['push', '--no-verify', 'origin', 'v0.4.1'] },
      {
        label: 'Moving production to d1bf6e9…',
        command: 'git',
        args: ['push', '--no-verify', 'origin', `${COMMIT}:refs/heads/production`],
      },
    ]);
  });

  it('skips the pre-push hook on every push: the commit already passed checks and e2e in CI', () => {
    const pushes = publishSteps('v0.4.1', COMMIT).filter((step) => step.args[0] === 'push');

    expect(pushes).toHaveLength(2);
    for (const push of pushes) expect(push.args).toContain('--no-verify');
  });
});
