// Types shared by the roadmap dashboard (MF-39).

export const OWNERS = ["H", "A", "H→A"] as const;
export type Owner = (typeof OWNERS)[number];

export interface RoadmapItem {
  id: string;
  done: boolean;
  sprint: string;
  text: string;
  estimateHours?: number;
  owner?: Owner;
  dependsOn: string[];
  line: number;
}

export interface Roadmap {
  deadline: string;
  sprints: string[];
  items: RoadmapItem[];
}

export interface RoadmapError {
  line?: number;
  message: string;
}

export type ParseResult = { ok: true; roadmap: Roadmap } | { ok: false; errors: RoadmapError[] };
