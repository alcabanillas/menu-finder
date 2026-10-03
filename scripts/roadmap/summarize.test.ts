import { describe, expect, it } from 'vitest';
import { summarize, type Summary, type SummaryResult } from './summarize';
import type { Roadmap, RoadmapError, RoadmapItem } from './types';

let nextLine = 1;
const item = (id: string, overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id,
  done: false,
  sprint: 'Sprint 1',
  text: `Item ${id}`,
  dependsOn: [],
  line: nextLine++,
  ...overrides,
});

const roadmap = (items: RoadmapItem[], deadline = '2026-10-25'): Roadmap => ({
  deadline,
  sprints: [...new Set(items.map((entry) => entry.sprint))],
  items,
});

const ok = (result: SummaryResult): Summary => {
  if (!result.ok) throw new Error(`expected a summary, got ${JSON.stringify(result.errors)}`);
  return result.summary;
};

const errorsOf = (result: SummaryResult): RoadmapError[] => {
  if (result.ok) throw new Error('expected errors, got a summary');
  return result.errors;
};

describe('summarize: figures', () => {
  const threeItems = roadmap([
    item('MF-01', { done: true, estimateHours: 3, owner: 'A' }),
    item('MF-02', { estimateHours: 4, owner: 'H' }),
    item('MF-03', { estimateHours: 6, owner: 'A' }),
  ]);

  it('computes the summary figures', () => {
    const summary = ok(summarize(threeItems, '2026-10-21'));

    expect(summary).toMatchObject({
      done: 1,
      total: 3,
      remainingHours: 10,
      daysLeft: 5,
      hoursPerDay: 2,
      deadlinePassed: false,
    });
  });

  it('splits the remaining hours by owner, counting only pending items', () => {
    const summary = ok(
      summarize(
        roadmap([
          item('MF-01', { done: true, estimateHours: 9, owner: 'H' }),
          item('MF-02', { estimateHours: 4, owner: 'H' }),
          item('MF-03', { estimateHours: 2, owner: 'H→A' }),
          item('MF-04', { estimateHours: 6, owner: 'A' }),
          item('MF-05', { estimateHours: 1 }),
        ]),
        '2026-10-21',
      ),
    );

    expect(summary.remainingByOwner).toEqual({ H: 4, 'H→A': 2, A: 6, none: 1 });
  });

  it('counts the pending items without estimate or without owner', () => {
    const summary = ok(
      summarize(
        roadmap([
          item('MF-01', { done: true }),
          item('MF-02', { owner: 'H' }),
          item('MF-03', { estimateHours: 2 }),
          item('MF-04'),
        ]),
        '2026-10-21',
      ),
    );

    expect(summary.pendingWithoutEstimate).toBe(2);
    expect(summary.pendingWithoutOwner).toBe(2);
  });

  it('counts the deadline day as a day left', () => {
    const summary = ok(summarize(threeItems, '2026-10-25'));

    expect([summary.daysLeft, summary.hoursPerDay, summary.deadlinePassed]).toEqual([1, 10, false]);
  });

  it('flags a passed deadline with 0 days left and no pace', () => {
    const summary = ok(summarize(threeItems, '2026-10-26'));

    expect([summary.daysLeft, summary.hoursPerDay, summary.deadlinePassed]).toEqual([0, null, true]);
  });

  it('groups the items by sprint, in roadmap order, with their progress', () => {
    const summary = ok(
      summarize(
        roadmap([
          item('MF-01', { done: true, sprint: 'Sprint 1' }),
          item('MF-02', { sprint: 'Sprint 1' }),
          item('MF-20', { sprint: 'Sprint 2' }),
        ]),
        '2026-10-21',
      ),
    );

    expect(summary.sprints.map((sprint) => [sprint.name, sprint.done, sprint.total])).toEqual([
      ['Sprint 1', 1, 2],
      ['Sprint 2', 0, 1],
    ]);
  });

  it('sums the remaining hours of each sprint, counting only pending items', () => {
    const summary = ok(
      summarize(
        roadmap([
          item('MF-01', { done: true, estimateHours: 9, sprint: 'Sprint 1' }),
          item('MF-02', { estimateHours: 4, sprint: 'Sprint 1' }),
          item('MF-03', { sprint: 'Sprint 1' }),
          item('MF-20', { estimateHours: 2.5, sprint: 'Sprint 2' }),
        ]),
        '2026-10-21',
      ),
    );

    expect(summary.sprints.map((sprint) => sprint.remainingHours)).toEqual([4, 2.5]);
  });

  it('counts the items per state for the filter', () => {
    const summary = ok(
      summarize(
        roadmap([
          item('MF-01', { done: true }),
          item('MF-02'),
          item('MF-03', { dependsOn: ['MF-02'] }),
          item('MF-04'),
        ]),
        '2026-10-21',
      ),
    );

    expect(summary.stateCounts).toEqual({ pending: 3, ready: 2, blocked: 1, done: 1, all: 4 });
  });
});

describe('summarize: ready and blocked items', () => {
  const stateOf = (summary: Summary, id: string) =>
    summary.sprints.flatMap((sprint) => sprint.items).find((entry) => entry.id === id);

  it('marks a pending item as ready when all its dependencies are done', () => {
    const summary = ok(
      summarize(
        roadmap([
          item('MF-10', { done: true }),
          item('MF-14', { done: true }),
          item('MF-16', { dependsOn: ['MF-14', 'MF-10'] }),
        ]),
        '2026-10-21',
      ),
    );

    expect(stateOf(summary, 'MF-16')).toMatchObject({ state: 'ready', blockedBy: [] });
    expect(summary.ready.map((entry) => entry.id)).toEqual(['MF-16']);
  });

  it('marks a pending item with no dependencies as ready', () => {
    const summary = ok(summarize(roadmap([item('MF-02')]), '2026-10-21'));

    expect(summary.ready.map((entry) => entry.id)).toEqual(['MF-02']);
  });

  it('marks a pending item as blocked by its pending dependencies', () => {
    const summary = ok(
      summarize(
        roadmap([item('MF-10', { done: true }), item('MF-14'), item('MF-16', { dependsOn: ['MF-14', 'MF-10'] })]),
        '2026-10-21',
      ),
    );

    expect(stateOf(summary, 'MF-16')).toMatchObject({ state: 'blocked', blockedBy: ['MF-14'] });
    expect(summary.ready.map((entry) => entry.id)).toEqual(['MF-14']);
  });

  it('marks a done item as done', () => {
    const summary = ok(summarize(roadmap([item('MF-01', { done: true })]), '2026-10-21'));

    expect(stateOf(summary, 'MF-01')?.state).toBe('done');
  });
});

describe('summarize: invalid dependencies', () => {
  it('rejects a dependency on an unknown ID, naming the item, its line and the ID', () => {
    const errors = errorsOf(summarize(roadmap([item('MF-16', { dependsOn: ['MF-99'], line: 42 })]), '2026-10-21'));

    expect(errors).toEqual([{ line: 42, message: expect.stringMatching(/MF-16.*MF-99/) }]);
  });

  it('rejects a self-dependency', () => {
    const errors = errorsOf(summarize(roadmap([item('MF-16', { dependsOn: ['MF-16'], line: 7 })]), '2026-10-21'));

    expect(errors).toEqual([{ line: 7, message: expect.stringContaining('MF-16') }]);
  });

  it('rejects a dependency cycle, naming the IDs in it', () => {
    const errors = errorsOf(
      summarize(
        roadmap([
          item('MF-15'),
          item('MF-16', { dependsOn: ['MF-17'] }),
          item('MF-17', { dependsOn: ['MF-18'] }),
          item('MF-18', { dependsOn: ['MF-16', 'MF-15'] }),
        ]),
        '2026-10-21',
      ),
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('MF-16 → MF-17 → MF-18 → MF-16');
  });
});
