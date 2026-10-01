// Turns a parsed roadmap into the dashboard figures (MF-39). Pure: the run date is a parameter.

import type { Owner, Roadmap, RoadmapError, RoadmapItem } from "./types";

export type ItemState = "done" | "ready" | "blocked";

export interface ItemView extends RoadmapItem {
  state: ItemState;
  blockedBy: string[];
}

export interface SprintView {
  name: string;
  done: number;
  total: number;
  remainingHours: number;
  items: ItemView[];
}

export type StateCounts = Record<ItemState | "pending" | "all", number>;

export interface Summary {
  deadline: string;
  today: string;
  done: number;
  total: number;
  remainingHours: number;
  remainingByOwner: Record<Owner | "none", number>;
  pendingWithoutEstimate: number;
  pendingWithoutOwner: number;
  daysLeft: number;
  deadlinePassed: boolean;
  hoursPerDay: number | null;
  ready: ItemView[];
  stateCounts: StateCounts;
  sprints: SprintView[];
}

export type SummaryResult = { ok: true; summary: Summary } | { ok: false; errors: RoadmapError[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

const dependencyErrors = (items: RoadmapItem[]): RoadmapError[] => {
  const ids = new Set(items.map((entry) => entry.id));
  return items.flatMap((entry) =>
    entry.dependsOn.flatMap((dependency) => {
      if (dependency === entry.id) return [{ line: entry.line, message: `${entry.id} depends on itself` }];
      if (!ids.has(dependency)) return [{ line: entry.line, message: `${entry.id} depends on unknown ${dependency}` }];
      return [];
    }),
  );
};

// Depth-first search; returns the first cycle found as a list of IDs that closes on itself.
const findCycle = (items: RoadmapItem[]): string[] | undefined => {
  const dependsOn = new Map(items.map((entry) => [entry.id, entry.dependsOn]));
  const finished = new Set<string>();
  const path: string[] = [];

  const visit = (id: string): string[] | undefined => {
    const start = path.indexOf(id);
    if (start !== -1) return [...path.slice(start), id];
    if (finished.has(id)) return undefined;
    path.push(id);
    for (const dependency of dependsOn.get(id) ?? []) {
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    path.pop();
    finished.add(id);
    return undefined;
  };

  for (const entry of items) {
    const cycle = visit(entry.id);
    if (cycle) return cycle;
  }
  return undefined;
};

const sum = (items: RoadmapItem[]) => items.reduce((total, entry) => total + (entry.estimateHours ?? 0), 0);

export function summarize(roadmap: Roadmap, today: string): SummaryResult {
  const { items } = roadmap;

  const errors = dependencyErrors(items);
  if (errors.length > 0) return { ok: false, errors };
  const cycle = findCycle(items);
  if (cycle) return { ok: false, errors: [{ message: `dependency cycle: ${cycle.join(" → ")}` }] };

  const doneIds = new Set(items.filter((entry) => entry.done).map((entry) => entry.id));
  const views: ItemView[] = items.map((entry) => {
    if (entry.done) return { ...entry, state: "done", blockedBy: [] };
    const blockedBy = entry.dependsOn.filter((dependency) => !doneIds.has(dependency));
    return { ...entry, state: blockedBy.length === 0 ? "ready" : "blocked", blockedBy };
  });

  const pending = items.filter((entry) => !entry.done);
  const inState = (state: ItemState) => views.filter((view) => view.state === state);
  const ownedBy = (owner: Owner | undefined) => sum(pending.filter((entry) => entry.owner === owner));
  const remainingHours = sum(pending);

  const daysToDeadline = dayNumber(roadmap.deadline) - dayNumber(today);
  const deadlinePassed = daysToDeadline < 0;
  const daysLeft = deadlinePassed ? 0 : daysToDeadline + 1;

  return {
    ok: true,
    summary: {
      deadline: roadmap.deadline,
      today,
      done: doneIds.size,
      total: items.length,
      remainingHours,
      remainingByOwner: { H: ownedBy("H"), "H→A": ownedBy("H→A"), A: ownedBy("A"), none: ownedBy(undefined) },
      pendingWithoutEstimate: pending.filter((entry) => entry.estimateHours === undefined).length,
      pendingWithoutOwner: pending.filter((entry) => entry.owner === undefined).length,
      daysLeft,
      deadlinePassed,
      hoursPerDay: deadlinePassed ? null : remainingHours / daysLeft,
      ready: inState("ready"),
      stateCounts: {
        pending: pending.length,
        ready: inState("ready").length,
        blocked: inState("blocked").length,
        done: doneIds.size,
        all: items.length,
      },
      sprints: roadmap.sprints.map((name) => {
        const sprintItems = views.filter((view) => view.sprint === name);
        return {
          name,
          done: sprintItems.filter((view) => view.done).length,
          total: sprintItems.length,
          remainingHours: sum(sprintItems.filter((view) => !view.done)),
          items: sprintItems,
        };
      }),
    },
  };
}
