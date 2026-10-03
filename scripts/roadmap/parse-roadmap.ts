// Parses context/roadmap.md into items, sprints and deadline (MF-39).
// Notation: `- ⬜ **MF-16** (~10 h · A · tras MF-14, MF-10) Text`; every metadata field is optional.

import { OWNERS, type Owner, type ParseResult, type RoadmapError, type RoadmapItem } from './types';

const ITEM = /^\s*-\s*(✅|⬜)\s*\*\*(MF-\d+)\*\*\s*(?:\(([^)]*)\))?\s*(.*)$/u;
const SPRINT = /^##\s+(Sprint\s+\d+.*)$/;
const OTHER_SECTION = /^##\s/;
const DEADLINE = /^\*\*Fecha límite:\*\*\s*(\S*)/;
const ESTIMATE = /^~(\d+(?:[.,]\d+)?)\s*h$/;
const DEPENDENCIES = /^tras\s+(.+)$/;
const ID = /^MF-\d+$/;

type Metadata = Pick<RoadmapItem, 'estimateHours' | 'owner' | 'dependsOn'>;
type Field = 'estimate' | 'owner' | 'dependencies';
const FIELD_ORDER: Field[] = ['estimate', 'owner', 'dependencies'];

const isOwner = (value: string): value is Owner => (OWNERS as readonly string[]).includes(value);

const fieldKind = (field: string): Field => {
  if (field.startsWith('~')) return 'estimate';
  if (DEPENDENCIES.test(field) || field.startsWith('tras')) return 'dependencies';
  return 'owner';
};

// Returns the metadata, or the reason it is invalid.
const parseMetadata = (block: string): Metadata | string => {
  const metadata: Metadata = { dependsOn: [] };
  let lastField = -1;
  for (const field of block.split('·').map((part) => part.trim())) {
    const kind = fieldKind(field);
    const position = FIELD_ORDER.indexOf(kind);
    if (position <= lastField) return 'metadata fields must follow the order estimate · owner · dependencies';
    lastField = position;

    if (kind === 'estimate') {
      const match = ESTIMATE.exec(field);
      const hours = match ? Number(match[1].replace(',', '.')) : Number.NaN;
      if (!(hours > 0)) return `invalid estimate "${field}", expected "~N h" with N > 0`;
      metadata.estimateHours = hours;
    } else if (kind === 'owner') {
      if (!isOwner(field)) return `unknown owner "${field}", expected one of ${OWNERS.join(', ')}`;
      metadata.owner = field;
    } else {
      const ids = (DEPENDENCIES.exec(field)?.[1] ?? '').split(',').map((id) => id.trim());
      const invalid = ids.find((id) => !ID.test(id));
      if (invalid !== undefined) return `invalid dependency "${invalid}", expected "tras MF-xx, MF-yy"`;
      metadata.dependsOn = ids;
    }
  }
  return metadata;
};

const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

export function parseRoadmap(markdown: string): ParseResult {
  const errors: RoadmapError[] = [];
  const items: RoadmapItem[] = [];
  const sprints: string[] = [];
  const firstLineOf = new Map<string, number>();
  let deadline: string | undefined;
  let sprint: string | undefined;

  markdown.split(/\r?\n/).forEach((text, index) => {
    const line = index + 1;

    const deadlineMatch = DEADLINE.exec(text);
    if (deadlineMatch) {
      const value = deadlineMatch[1];
      if (deadline !== undefined) errors.push({ line, message: 'more than one Fecha límite line' });
      else if (!isValidDate(value)) errors.push({ line, message: `invalid Fecha límite "${value}", expected YYYY-MM-DD` });
      else deadline = value;
      return;
    }

    const sprintMatch = SPRINT.exec(text);
    if (sprintMatch) {
      sprint = sprintMatch[1].trim();
      sprints.push(sprint);
      return;
    }
    if (OTHER_SECTION.test(text)) {
      sprint = undefined;
      return;
    }

    const itemMatch = ITEM.exec(text);
    if (!itemMatch) return;
    const [, status, id, block, rest] = itemMatch;

    const previous = firstLineOf.get(id);
    if (previous !== undefined) {
      errors.push({ line, message: `duplicate ID ${id} on lines ${previous} and ${line}` });
      return;
    }
    firstLineOf.set(id, line);

    if (sprint === undefined) {
      errors.push({ line, message: `${id} is outside a "## Sprint <n>" section` });
      return;
    }

    const metadata = block === undefined ? { dependsOn: [] } : parseMetadata(block);
    if (typeof metadata === 'string') {
      errors.push({ line, message: `${id}: ${metadata}` });
      return;
    }

    items.push({ id, done: status === '✅', sprint, text: rest.trim(), ...metadata, line });
  });

  if (deadline === undefined && !errors.some((error) => error.message.includes('Fecha límite'))) {
    errors.push({ message: 'missing "**Fecha límite:** YYYY-MM-DD" line' });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, roadmap: { deadline: deadline as string, sprints, items } };
}
