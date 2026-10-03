import { describe, expect, it } from 'vitest';
import { escapeHtml, renderHtml } from './render-html';
import { summarize, type Summary } from './summarize';
import type { RoadmapItem } from './types';

let nextLine = 1;
const item = (id: string, overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id,
  done: false,
  sprint: 'Sprint 1 — Datos',
  text: `Texto de ${id}`,
  dependsOn: [],
  line: nextLine++,
  ...overrides,
});

const summaryOf = (items: RoadmapItem[], today = '2026-10-21'): Summary => {
  const result = summarize(
    { deadline: '2026-10-25', sprints: [...new Set(items.map((entry) => entry.sprint))], items },
    today,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.summary;
};

const sectionOf = (html: string, marker: string) => {
  const start = html.indexOf(`data-section="${marker}"`);
  if (start === -1) throw new Error(`section ${marker} not found`);
  return html.slice(start, html.indexOf('</section>', start));
};

const blockOfItem = (html: string, id: string) => {
  const start = html.indexOf(`data-item="${id}"`);
  if (start === -1) throw new Error(`item ${id} not found`);
  return html.slice(start, html.indexOf('</li>', start));
};

describe('renderHtml', () => {
  const items = [
    item('MF-01', { done: true, estimateHours: 3, owner: 'A' }),
    item('MF-14', { estimateHours: 7, owner: 'H→A' }),
    item('MF-16', { estimateHours: 10, owner: 'A', dependsOn: ['MF-14', 'MF-01'] }),
    item('MF-20', { sprint: 'Sprint 2 — App', owner: 'H' }),
  ];
  const html = renderHtml(summaryOf(items));

  it('shows one block per sprint, in roadmap order, with its progress', () => {
    const first = html.indexOf('data-sprint="Sprint 1 — Datos"');
    const second = html.indexOf('data-sprint="Sprint 2 — App"');

    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(sectionOf(html, 'sprint-Sprint 1 — Datos')).toContain('1/3');
    expect(sectionOf(html, 'sprint-Sprint 2 — App')).toContain('0/1');
  });

  it('shows each item with its owner and dependencies, and its estimate in a column of its own', () => {
    const block = blockOfItem(html, 'MF-16');

    expect(block).toContain('MF-16');
    expect(block).toMatch(/<span class="hours">10 h<\/span>/);
    expect(block).toContain('A');
    expect(block).toContain('tras MF-14, MF-01');
    expect(block).toContain('bloqueado por MF-14');
  });

  it('marks a pending item without estimate in the estimate column', () => {
    expect(blockOfItem(html, 'MF-20')).toMatch(/<span class="hours">sin estimar<\/span>/);
  });

  it('shows a dash for a done item without estimate', () => {
    const done = renderHtml(summaryOf([item('MF-05', { done: true })]));

    expect(blockOfItem(done, 'MF-05')).toMatch(/<span class="hours">—<\/span>/);
  });

  it('shows the remaining hours of each sprint', () => {
    expect(sectionOf(html, 'sprint-Sprint 1 — Datos')).toContain('17 h pendientes');
  });

  it('tags each row with its state and owner, so the filters can match it', () => {
    expect(html).toContain('data-item="MF-16" data-state="blocked" data-owner="A"');
    expect(html).toContain('data-item="MF-20" data-state="ready" data-owner="H"');
    expect(html).toContain('data-item="MF-01" data-state="done" data-owner="A"');
  });

  it('offers a state filter with counts, on Pendientes by default', () => {
    const filters = sectionOf(html, 'filters');

    expect(filters).toMatch(/id="state-pending"[^>]*checked/);
    expect(filters).toContain('Pendientes (3)');
    expect(filters).toContain('Listos (2)');
    expect(filters).toContain('Bloqueados (1)');
    expect(filters).toContain('Hechos (1)');
    expect(filters).toContain('Todos (4)');
  });

  it('offers an owner filter, on Todos by default', () => {
    const filters = sectionOf(html, 'filters');

    expect(filters).toMatch(/id="owner-all"[^>]*checked/);
    for (const id of ['owner-H', 'owner-HA', 'owner-A']) expect(filters).toContain(`id="${id}"`);
  });

  it('hides done items and empty sprints under the default filter, with CSS only', () => {
    expect(html).toContain('body:has(#state-pending:checked) li[data-state="done"]');
    expect(html).toMatch(/body:has\(#state-pending:checked\) section\[data-sprint\]:not\(:has\(/);
  });

  it('no longer has a separate list of ready items', () => {
    expect(html).not.toContain('data-section="ready"');
  });

  it('shows the summary figures and the split by owner', () => {
    const summary = sectionOf(html, 'summary');

    expect(summary).toContain('1/4');
    expect(summary).toContain('17 h');
    expect(summary).toContain('5 días');
    expect(summary).toContain('3,4 h/día');
    expect(summary).toMatch(/H→A[^<]*<[^>]*>\s*7 h/);
  });

  it('flags a passed deadline instead of a pace', () => {
    const passed = sectionOf(renderHtml(summaryOf(items, '2026-10-26')), 'summary');

    expect(passed).toContain('Plazo vencido');
    expect(passed).not.toContain('h/día');
  });

  it('loads nothing from the network and runs no script', () => {
    expect(html).not.toMatch(/<script|<link|<img|<iframe|src=|@import|url\(/i);
  });

  it('escapes roadmap text so markup in an item is shown literally', () => {
    const hostile = renderHtml(summaryOf([item('MF-02', { text: '<script>alert(1)</script> & "x"' })]));

    expect(hostile).not.toContain('<script>');
    expect(hostile).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml('<a href=\'x\'>"&"</a>')).toBe('&lt;a href=&#39;x&#39;&gt;&quot;&amp;&quot;&lt;/a&gt;');
  });
});
