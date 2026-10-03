import { describe, expect, it } from 'vitest';
import { parseRoadmap } from './parse-roadmap';
import type { ParseResult, Roadmap, RoadmapError } from './types';

const DEADLINE = '**Fecha límite:** 2026-10-25';

const roadmapOf = (...lines: string[]) => [DEADLINE, '', ...lines].join('\n');

const parsed = (result: ParseResult): Roadmap => {
  if (!result.ok) throw new Error(`expected a valid roadmap, got ${JSON.stringify(result.errors)}`);
  return result.roadmap;
};

const errorsOf = (result: ParseResult): RoadmapError[] => {
  if (result.ok) throw new Error('expected errors, got a valid roadmap');
  return result.errors;
};

describe('parseRoadmap: notation', () => {
  it('reads an item with all fields', () => {
    const roadmap = parsed(
      parseRoadmap(roadmapOf('## Sprint 1 — Datos', '- ⬜ **MF-16** (~10 h · A · tras MF-14, MF-10) CLI de ingesta')),
    );

    expect(roadmap.items).toEqual([
      {
        id: 'MF-16',
        done: false,
        sprint: 'Sprint 1 — Datos',
        text: 'CLI de ingesta',
        estimateHours: 10,
        owner: 'A',
        dependsOn: ['MF-14', 'MF-10'],
        line: 4,
      },
    ]);
  });

  it('reads a partial block with only an estimate, accepting a decimal comma', () => {
    const [item] = parsed(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-02** (~0,5 h) Revisión OWASP'))).items;

    expect([item.estimateHours, item.owner, item.dependsOn]).toEqual([0.5, undefined, []]);
  });

  it('reads a partial block with only an owner', () => {
    const [item] = parsed(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-19** (H) Decidir'))).items;

    expect([item.estimateHours, item.owner, item.dependsOn]).toEqual([undefined, 'H', []]);
  });

  it('reads the H→A owner', () => {
    const [item] = parsed(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-14** (~7 h · H→A) Spike'))).items;

    expect(item.owner).toBe('H→A');
  });

  it('reads an item without metadata, keeping the rest of the text', () => {
    const [item] = parsed(parseRoadmap(roadmapOf('## Sprint 1', '- ✅ **MF-01** Repo del producto creado'))).items;

    expect(item).toMatchObject({ id: 'MF-01', done: true, text: 'Repo del producto creado', dependsOn: [] });
    expect([item.estimateHours, item.owner]).toEqual([undefined, undefined]);
  });

  it('assigns each item to the nearest preceding sprint heading, keeping the sprint order', () => {
    const roadmap = parsed(
      parseRoadmap(
        roadmapOf('## Sprint 1 — Datos', '- ✅ **MF-01** Uno', '## Sprint 2 — App', '- ⬜ **MF-20** Dos'),
      ),
    );

    expect(roadmap.sprints).toEqual(['Sprint 1 — Datos', 'Sprint 2 — App']);
    expect(roadmap.items.map((item) => [item.id, item.sprint])).toEqual([
      ['MF-01', 'Sprint 1 — Datos'],
      ['MF-20', 'Sprint 2 — App'],
    ]);
  });

  it('reads the deadline', () => {
    expect(parsed(parseRoadmap(roadmapOf('## Sprint 1', '- ✅ **MF-01** Uno'))).deadline).toBe('2026-10-25');
  });

  it('ignores lines that are not items', () => {
    const roadmap = parsed(
      parseRoadmap(roadmapOf('## Sprint 1', 'Texto que cita **MF-14** (~3 h)', '- Una nota suelta', '- ✅ **MF-01** Uno')),
    );

    expect(roadmap.items.map((item) => item.id)).toEqual(['MF-01']);
  });

  it('accepts CRLF line endings', () => {
    const roadmap = parsed(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-02** (~1 h) Uno').replace(/\n/g, '\r\n')));

    expect(roadmap.items[0]).toMatchObject({ id: 'MF-02', estimateHours: 1, text: 'Uno' });
  });
});

describe('parseRoadmap: invalid input', () => {
  it.each(['~abc h', '~0 h', '~-3 h'])('rejects the malformed estimate %s, naming the item and its line', (estimate) => {
    const errors = errorsOf(parseRoadmap(roadmapOf('## Sprint 1', `- ⬜ **MF-14** (${estimate}) Spike`)));

    expect(errors).toEqual([expect.objectContaining({ line: 4, message: expect.stringContaining('MF-14') })]);
  });

  it('rejects an unknown owner, naming the item, its line and the accepted owners', () => {
    const errors = errorsOf(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-14** (~2 h · X) Spike')));

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(4);
    expect(errors[0].message).toContain('MF-14');
    expect(errors[0].message).toContain('H, A, H→A');
  });

  it('rejects metadata fields out of order', () => {
    const errors = errorsOf(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-14** (A · ~2 h) Spike')));

    expect(errors).toEqual([expect.objectContaining({ line: 4, message: expect.stringContaining('MF-14') })]);
  });

  it('rejects a malformed dependency list', () => {
    const errors = errorsOf(parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-16** (tras MF-14, foo) CLI')));

    expect(errors).toEqual([expect.objectContaining({ line: 4, message: expect.stringContaining('MF-16') })]);
  });

  it('rejects a roadmap without deadline', () => {
    const errors = errorsOf(parseRoadmap(['## Sprint 1', '- ✅ **MF-01** Uno'].join('\n')));

    expect(errors).toEqual([expect.objectContaining({ message: expect.stringContaining('Fecha límite') })]);
  });

  it.each(['2026-13-01', '2026-02-30', '25/10/2026'])('rejects the invalid deadline %s', (date) => {
    const errors = errorsOf(parseRoadmap([`**Fecha límite:** ${date}`, '## Sprint 1', '- ✅ **MF-01** Uno'].join('\n')));

    expect(errors).toEqual([expect.objectContaining({ line: 1, message: expect.stringContaining(date) })]);
  });

  it('rejects a duplicate ID, naming both lines', () => {
    const errors = errorsOf(parseRoadmap(roadmapOf('## Sprint 1', '- ✅ **MF-01** Uno', '- ⬜ **MF-01** Otra vez')));

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(5);
    expect(errors[0].message).toMatch(/MF-01.*4.*5/);
  });

  it('rejects an item outside a sprint', () => {
    const errors = errorsOf(parseRoadmap(roadmapOf('- ✅ **MF-01** Uno')));

    expect(errors).toEqual([expect.objectContaining({ line: 3, message: expect.stringContaining('MF-01') })]);
  });

  it('reports every error, not just the first', () => {
    const errors = errorsOf(
      parseRoadmap(roadmapOf('## Sprint 1', '- ⬜ **MF-02** (~x h) Uno', '- ⬜ **MF-03** (Z) Dos')),
    );

    expect(errors.map((error) => error.line)).toEqual([4, 5]);
  });
});
