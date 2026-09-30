import { describe, expect, it } from "vitest";
import { escapeHtml, renderHtml } from "./render-html";
import { summarize, type Summary } from "./summarize";
import type { RoadmapItem } from "./types";

let nextLine = 1;
const item = (id: string, overrides: Partial<RoadmapItem> = {}): RoadmapItem => ({
  id,
  done: false,
  sprint: "Sprint 1 — Datos",
  text: `Texto de ${id}`,
  dependsOn: [],
  line: nextLine++,
  ...overrides,
});

const summaryOf = (items: RoadmapItem[], today = "2026-10-21"): Summary => {
  const result = summarize(
    { deadline: "2026-10-25", sprints: [...new Set(items.map((entry) => entry.sprint))], items },
    today,
  );
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.summary;
};

const sectionOf = (html: string, marker: string) => {
  const start = html.indexOf(`data-section="${marker}"`);
  if (start === -1) throw new Error(`section ${marker} not found`);
  return html.slice(start, html.indexOf("</section>", start));
};

const blockOfItem = (html: string, id: string) => {
  const start = html.indexOf(`data-item="${id}"`);
  if (start === -1) throw new Error(`item ${id} not found`);
  return html.slice(start, html.indexOf("</li>", start));
};

describe("renderHtml", () => {
  const items = [
    item("MF-01", { done: true, estimateHours: 3, owner: "A" }),
    item("MF-14", { estimateHours: 7, owner: "H→A" }),
    item("MF-16", { estimateHours: 10, owner: "A", dependsOn: ["MF-14", "MF-01"] }),
    item("MF-20", { sprint: "Sprint 2 — App", owner: "H" }),
  ];
  const html = renderHtml(summaryOf(items));

  it("shows one block per sprint, in roadmap order, with its progress", () => {
    const first = html.indexOf('data-sprint="Sprint 1 — Datos"');
    const second = html.indexOf('data-sprint="Sprint 2 — App"');

    expect(first).toBeGreaterThan(-1);
    expect(second).toBeGreaterThan(first);
    expect(sectionOf(html, "sprint-Sprint 1 — Datos")).toContain("1/3");
    expect(sectionOf(html, "sprint-Sprint 2 — App")).toContain("0/1");
  });

  it("shows each item with its estimate, owner and dependencies", () => {
    const block = blockOfItem(html, "MF-16");

    expect(block).toContain("MF-16");
    expect(block).toContain("10 h");
    expect(block).toContain("A");
    expect(block).toContain("tras MF-14, MF-01");
    expect(block).toContain("bloqueado por MF-14");
  });

  it("marks an item without estimate", () => {
    expect(blockOfItem(html, "MF-20")).toContain("sin estimar");
  });

  it("lists the ready items together", () => {
    const ready = sectionOf(html, "ready");

    expect(ready).toContain("MF-14");
    expect(ready).toContain("MF-20");
    expect(ready).not.toContain("MF-16");
    expect(ready).not.toContain("MF-01");
  });

  it("shows the summary figures and the split by owner", () => {
    const summary = sectionOf(html, "summary");

    expect(summary).toContain("1/4");
    expect(summary).toContain("17 h");
    expect(summary).toContain("5 días");
    expect(summary).toContain("3,4 h/día");
    expect(summary).toMatch(/H→A[^<]*<[^>]*>\s*7 h/);
  });

  it("flags a passed deadline instead of a pace", () => {
    const passed = sectionOf(renderHtml(summaryOf(items, "2026-10-26")), "summary");

    expect(passed).toContain("Plazo vencido");
    expect(passed).not.toContain("h/día");
  });

  it("loads nothing from the network and runs no script", () => {
    expect(html).not.toMatch(/<script|<link|<img|<iframe|src=|@import|url\(/i);
  });

  it("escapes roadmap text so markup in an item is shown literally", () => {
    const hostile = renderHtml(summaryOf([item("MF-02", { text: "<script>alert(1)</script> & \"x\"" })]));

    expect(hostile).not.toContain("<script>");
    expect(hostile).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<a href='x'>"&"</a>`)).toBe("&lt;a href=&#39;x&#39;&gt;&quot;&amp;&quot;&lt;/a&gt;");
  });
});
