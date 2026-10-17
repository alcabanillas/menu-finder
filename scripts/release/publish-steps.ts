// What pnpm release runs once it is confirmed: tag the commit, push the tag and move production.
// The pushes skip the pre-push hook: the commit is already in main with checks and e2e green (release-problems.ts), so the
// hook would only repeat the CI for minutes (decided by the author on 2026-10-17, MF-22.6).

export type PublishStep = { label: string; command: string; args: string[] };

export function publishSteps(tag: string, commit: string): PublishStep[] {
  const short = commit.slice(0, 7);
  return [
    { label: `Tagging ${short} as ${tag}…`, command: 'git', args: ['tag', tag, commit] },
    { label: `Pushing ${tag}…`, command: 'git', args: ['push', '--no-verify', 'origin', tag] },
    {
      label: `Moving production to ${short}…`,
      command: 'git',
      args: ['push', '--no-verify', 'origin', `${commit}:refs/heads/production`],
    },
  ];
}
