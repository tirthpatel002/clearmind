// Memory constellation (SVG): per-scope clusters for large memories, otherwise one dot per memory.
import type { ClusterGraph, Memory, NodeGraph } from "@clearmind/core/types";
import { $, esc, hash } from "../dom.js";
import { state } from "../state.js";
import { PREFERRED, scopeColor } from "./palette.js";

const W = 600;
const H = 280;
const PAD = 26;
const SLOTS: [number, number][] = [[110, 120], [290, 95], [480, 105], [215, 210], [420, 215], [540, 220], [60, 215], [360, 160]];
const CENTER: [number, number] = [300, 140];

/** Fixed positions for scopes: preferred scopes keep their slot, others fill the gaps. */
function slotsFor(names: string[]): Record<string, [number, number]> {
  const used: Record<number, boolean> = {};
  const out: Record<string, [number, number]> = {};
  for (const t of names) {
    const p = PREFERRED[t];
    if (p !== undefined && !used[p]) {
      out[t] = SLOTS[p]!;
      used[p] = true;
    }
  }
  let k = 0;
  for (const t of names) {
    if (out[t]) continue;
    while (used[k]) k++;
    out[t] = SLOTS[k % SLOTS.length]!;
    used[k] = true;
  }
  return out;
}

function halo(id: string, color: string): string {
  return (
    `<radialGradient id="halo-${id}"><stop offset="0" stop-color="${color}" stop-opacity=".55"/>` +
    `<stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`
  );
}

function defs(): string {
  const s = state.s;
  const scopes = Object.fromEntries(s.scopes.concat(Object.keys(s.memories.perScope)).map((t) => [t, scopeColor(t)]));
  return Object.entries(scopes).map(([t, c]) => halo(esc(t), c)).join("") + halo("other", "#C9CDD2");
}

function legend(scopes: string[]): void {
  const items = scopes.slice(0, 8).map((t) => `<span><i style="background:${scopeColor(t)}"></i>${esc(t)}</span>`);
  $("legend").innerHTML =
    items.join("") + '<span><i style="background:#7BC96F"></i>habit link</span><span><i style="background:#E5533D"></i>conflict</span>';
}

function renderClusters(g: ClusterGraph): void {
  const cs = g.clusters.slice(0, 8);
  const max = Math.max(1, ...cs.map((c) => c.count));
  const pos = slotsFor(cs.map((c) => c.scope));
  let n = "";
  for (const c of cs) {
    const [x, y] = pos[c.scope]!;
    const r = 18 + Math.sqrt(c.count / max) * 38;
    const scope = esc(c.scope);
    n +=
      `<g class="cl" tabindex="0" role="button" aria-label="Open ${scope}, ${c.count} memories" ` +
      `data-act="openScope" data-enter="openScope" data-scope="${scope}">` +
      `<circle cx="${x}" cy="${y}" r="${(r * 1.6).toFixed(1)}" fill="url(#halo-${scope})"/>` +
      `<circle class="core" cx="${x}" cy="${y}" r="${r.toFixed(1)}" fill="${scopeColor(c.scope)}" stroke="#fff" stroke-width="3"/>` +
      `<text x="${x}" y="${y + 2}" text-anchor="middle" font-size="15" font-weight="800" fill="#141414">${c.count.toLocaleString()}</text>` +
      `<text x="${x}" y="${Math.min(H - 6, y + r + 16)}" text-anchor="middle" font-size="10" letter-spacing="2" font-weight="700" fill="#8A8F98">` +
      `${esc(c.scope.toUpperCase())}</text></g>`;
  }
  const caption =
    `<text x="${W - 8}" y="18" text-anchor="end" font-size="11" fill="#8A8F98">` +
    `${g.total.toLocaleString()} memories · click a group to open it</text>`;
  $("constel").innerHTML = `<defs>${defs()}</defs>` + n + caption;
}

type Placed = [x: number, y: number, scope: string, m: Memory, r: number];

function place(list: Memory[], centers: Record<string, [number, number]>, big: boolean): Record<string, Placed> {
  const zoomed = !!state.graphScope;
  const pos: Record<string, Placed> = {};
  const idx: Record<string, number> = {};
  for (const m of list) {
    const t = m.tags[0] || "other";
    const [x, y] = centers[t] || CENTER;
    const i = (idx[t] = (idx[t] || 0) + 1);
    const angle = i * 2.39996 + hash(t) * 6.28;
    const rr = zoomed ? 8 + Math.sqrt(i) * (big ? 19 : 24) : 14 + Math.sqrt(i) * 24;
    const r = (m.status === "active" ? 7 + m.confidence * 9 : 5) * (big ? 0.6 : 1);
    let px = x + Math.cos(angle) * rr * (zoomed ? 1.9 : 1.25);
    let py = y + Math.sin(angle) * rr * (zoomed ? 0.95 : 0.85);
    px = Math.min(W - PAD - r, Math.max(PAD + r, px));
    py = Math.min(H - PAD - r, Math.max(PAD + r, py));
    pos[m.id] = [px, py, t, m, r];
  }
  return pos;
}

function edges(g: NodeGraph, pos: Record<string, Placed>): string {
  let l = "";
  const curve = (a: string, b: string, stroke: string, dotted: boolean, width: number) => {
    if (!pos[a] || !pos[b]) return;
    const [x1, y1] = pos[a];
    const [x2, y2] = pos[b];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const k = 0.22;
    const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${(mx - (y2 - y1) * k).toFixed(1)} ${(my + (x2 - x1) * k).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
    l += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" ${dotted ? 'stroke-dasharray="0.1 6"' : ""}/>`;
  };
  g.edges.habit.forEach(([a, b]) => curve(a, b, "#7BC96F", true, 2.2));
  g.edges.correction.forEach(([a, b]) => curve(a, b, "#B9BCC0", true, 1.8));
  g.edges.conflict.forEach(([a, b]) => curve(a, b, "#E5533D", false, 1.6));
  return l;
}

function node(id: string, [x, y, t, m, r]: Placed, big: boolean): string {
  const on = m.status === "active";
  const right = x > W - 170;
  const lx = right ? x - r - 8 : x + r + 8;
  const label = m.text.length > 34 ? m.text.slice(0, 33) + "…" : m.text;
  const float = big ? "" : ` style="animation:fl ${(6 + hash(id) * 5).toFixed(1)}s ease-in-out -${(hash(id + "d") * 6).toFixed(1)}s infinite alternate"`;
  const glow = big ? "" : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(r * 2.1).toFixed(1)}" fill="url(#halo-${esc(t)})"/>`;
  const fill = on ? scopeColor(t === "other" ? "" : t) : "#fff";
  return (
    `<g class="nd" tabindex="0"${float}>${glow}` +
    `<circle class="core" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${fill}" ` +
    `stroke="${on ? "#fff" : "#B9BCC0"}" stroke-width="${big ? 1.5 : 2.5}" ${on ? "" : 'stroke-dasharray="2 3"'}/>` +
    `<text x="${lx.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${right ? "end" : "start"}" font-size="11.5" font-weight="600" ` +
    `fill="#141414" paint-order="stroke" stroke="#fff" stroke-width="4">${esc(label)}</text>` +
    `<title>${esc(m.text)}</title></g>`
  );
}

function scopeLabels(centers: Record<string, [number, number]>): string {
  return Object.entries(centers)
    .map(
      ([t, [x, y]]) =>
        `<text x="${x}" y="${Math.min(H - 8, y + 68)}" text-anchor="middle" font-size="10" letter-spacing="2" font-weight="700" fill="#B3B7BC">` +
        `${esc(t.toUpperCase())}</text>`,
    )
    .join("");
}

function backButton(g: NodeGraph, shown: number): string {
  return (
    '<g class="cl" tabindex="0" role="button" data-act="openScope" data-enter="openScope">' +
    '<rect x="8" y="6" width="104" height="24" rx="12" fill="#141414"/>' +
    '<text x="60" y="22" text-anchor="middle" font-size="11.5" font-weight="600" fill="#fff">← all groups</text></g>' +
    `<text x="${W - 8}" y="22" text-anchor="end" font-size="11" fill="#8A8F98">` +
    `${esc(state.graphScope)} · latest ${shown} of ${g.total.toLocaleString()}</text>`
  );
}

function renderNodes(g: NodeGraph): void {
  const list = g.nodes;
  const zoomed = state.graphScope;
  const names = [...new Set(list.map((m) => m.tags[0] || "other"))];
  const centers: Record<string, [number, number]> = zoomed ? { [zoomed]: CENTER } : slotsFor(names);
  const big = list.length > 40;
  const pos = place(list, centers, big);
  const nodes = Object.entries(pos).map(([id, p]) => node(id, p, big)).join("");
  const empty = list.length
    ? ""
    : '<text x="300" y="145" text-anchor="middle" font-size="14" fill="#8A8F98">Your memories will appear here.</text>';
  $("constel").innerHTML =
    `<defs>${defs()}</defs><style>@keyframes fl{to{transform:translateY(-3px)}}</style>` +
    (zoomed ? "" : scopeLabels(centers)) +
    `<g>${edges(g, pos)}</g><g>${nodes}</g>` +
    (zoomed ? backButton(g, list.length) : "") +
    empty;
}

export function renderConstellation(): void {
  const g = state.graph;
  if (!g) return;
  if (g.mode === "clusters") {
    legend(g.clusters.map((c) => c.scope));
    renderClusters(g);
    return;
  }
  legend([...new Set(g.nodes.map((m) => m.tags[0] || "other"))]);
  renderNodes(g);
}
