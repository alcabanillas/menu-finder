// Renders the dashboard as one self-contained HTML page (MF-39): inline CSS, no scripts, no network.
// Every string that comes from the roadmap goes through escapeHtml.

import type { ItemView, SprintView, Summary } from "./summarize";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char]);

const number = (value: number) => value.toLocaleString("es-ES", { maximumFractionDigits: 1 });
const hours = (value: number | undefined) => (value === undefined ? "sin estimar" : `${number(value)} h`);
const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

const STATE_LABEL = { done: "hecho", ready: "listo", blocked: "bloqueado" } as const;

const CSS = `
:root { --bg:#f7f7f5; --card:#fff; --text:#1f2328; --muted:#636c76; --line:#d8dee4; --accent:#2f6fde;
  --done:#1a7f37; --ready:#2f6fde; --blocked:#bf8700; }
@media (prefers-color-scheme: dark) { :root { --bg:#0d1117; --card:#161b22; --text:#e6edf3; --muted:#9198a1;
  --line:#30363d; --accent:#4c8dff; --done:#3fb950; --ready:#4c8dff; --blocked:#d29922; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
main { max-width:960px; margin:0 auto; padding:24px 16px 48px; }
h1 { font-size:1.5rem; margin:0 0 4px; } h2 { font-size:1.1rem; margin:0 0 12px; }
.muted { color:var(--muted); }
section { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:16px; margin-top:16px; }
.kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; }
.kpi strong { display:block; font-size:1.6rem; font-variant-numeric:tabular-nums; }
.owners { list-style:none; padding:0; margin:12px 0 0; display:flex; flex-wrap:wrap; gap:8px 20px; }
.bar { height:8px; background:var(--line); border-radius:4px; overflow:hidden; margin-bottom:12px; }
.bar > div { height:100%; background:var(--accent); }
ul.items { list-style:none; margin:0; padding:0; }
ul.items li { display:grid; grid-template-columns:auto 1fr auto; gap:4px 12px; padding:8px 0; border-top:1px solid var(--line); }
ul.items li:first-child { border-top:0; }
.id { font-weight:600; font-variant-numeric:tabular-nums; }
.meta { grid-column:2 / 4; color:var(--muted); font-size:.85rem; }
.tag { font-size:.75rem; font-weight:600; padding:1px 8px; border-radius:999px; border:1px solid currentColor; white-space:nowrap; align-self:start; }
.done { color:var(--done); } .ready { color:var(--ready); } .blocked { color:var(--blocked); }
`;

const ownerTag = (item: ItemView) => (item.owner ? escapeHtml(item.owner) : "sin responsable");

const itemRow = (item: ItemView) => {
  const meta = [hours(item.estimateHours), ownerTag(item)];
  if (item.dependsOn.length > 0) meta.push(`tras ${escapeHtml(item.dependsOn.join(", "))}`);
  if (item.blockedBy.length > 0) meta.push(`bloqueado por ${escapeHtml(item.blockedBy.join(", "))}`);
  return `<li data-item="${escapeHtml(item.id)}">
  <span class="id">${escapeHtml(item.id)}</span>
  <span>${escapeHtml(item.text)}</span>
  <span class="tag ${item.state}">${STATE_LABEL[item.state]}</span>
  <span class="meta">${meta.join(" · ")}</span></li>`;
};

const summarySection = (summary: Summary) => {
  const pace = summary.deadlinePassed
    ? `<div class="kpi"><span class="muted">Ritmo</span><strong class="blocked">Plazo vencido</strong></div>`
    : `<div class="kpi"><span class="muted">Ritmo necesario</span><strong>${number(summary.hoursPerDay ?? 0)} h/día</strong></div>`;
  const byOwner = summary.remainingByOwner;
  const gaps = [
    summary.pendingWithoutEstimate > 0 ? `${summary.pendingWithoutEstimate} pendientes sin estimar` : "",
    summary.pendingWithoutOwner > 0 ? `${summary.pendingWithoutOwner} pendientes sin responsable` : "",
  ].filter(Boolean);
  return `<section data-section="summary">
<div class="kpis">
  <div class="kpi"><span class="muted">Hechos</span><strong>${summary.done}/${summary.total}</strong></div>
  <div class="kpi"><span class="muted">Horas pendientes (estimadas)</span><strong>${hours(summary.remainingHours)}</strong></div>
  <div class="kpi"><span class="muted">Hasta ${escapeHtml(summary.deadline)}</span><strong>${summary.daysLeft} días</strong></div>
  ${pace}
</div>
<ul class="owners">
  <li><span>H</span> ${hours(byOwner.H)}</li>
  <li><span>H→A</span> ${hours(byOwner["H→A"])}</li>
  <li><span>A</span> ${hours(byOwner.A)}</li>
  <li><span>Sin responsable</span> ${hours(byOwner.none)}</li>
</ul>
${gaps.length > 0 ? `<p class="blocked">${gaps.join(" · ")}</p>` : ""}
</section>`;
};

const readySection = (ready: ItemView[]) => `<section data-section="ready">
<h2>Listos para empezar <span class="muted">(${ready.length}, se pueden trabajar en paralelo)</span></h2>
<ul class="items">${ready.map(itemRow).join("\n")}</ul>
</section>`;

const sprintSection = (sprint: SprintView) => {
  const name = escapeHtml(sprint.name);
  return `<section data-section="sprint-${name}" data-sprint="${name}">
<h2>${name} <span class="muted">${sprint.done}/${sprint.total}</span></h2>
<div class="bar"><div style="width:${percent(sprint.done, sprint.total)}%"></div></div>
<ul class="items">${sprint.items.map(itemRow).join("\n")}</ul>
</section>`;
};

export function renderHtml(summary: Summary): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Roadmap menu-finder</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>Roadmap menu-finder</h1>
<p class="muted">Generado el ${escapeHtml(summary.today)} desde context/roadmap.md. Horas: estimaciones, no mediciones. H = humano · A = agente · H→A = decide el humano, ejecuta un agente.</p>
${summarySection(summary)}
${readySection(summary.ready)}
${summary.sprints.map(sprintSection).join("\n")}
</main>
</body>
</html>
`;
}
