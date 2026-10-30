// Memory map: every memory is a Transformium particle; layouts morph with particle order preserved.
// Lines, hover and focus are drawn on an overlay canvas using the same projection as the engine.
import { transformium } from "@transformium/core/engine";

export type Layout = "graph" | "time" | "type" | "cluster";
export interface MapHandle { layout: Layout; setLayout(l: Layout): void; pulse(ids: string[]): void; destroy(): void }
interface Node { id: string; text: string; type: string; createdAt: string; kind?: string | null; severity?: string | null; confidence?: number | null; status?: string }
interface Edge { from: string; to: string; type: string; label?: string }

const TYPES = ["memory", "superseded", "insight", "security", "security-flag", "agent-run"];
const TONE: Record<string, number> = { memory: 0, superseded: 1, insight: 2, security: 3, "security-flag": 3, "agent-run": 4 };
const TONES = ["rgb(159,214,255)", "rgb(107,112,121)", "rgb(199,166,255)", "rgb(255,107,87)", "rgb(255,209,102)"];
const ECOL: Record<string, string> = { supersedes: "rgba(160,160,160,.55)", evidence: "rgba(199,166,255,.45)", "fixed-by": "rgba(120,230,140,.8)", "same-signature": "rgba(255,140,120,.6)", "same-entity": "rgba(159,214,255,.16)", "co-used": "rgba(255,209,102,.5)" };
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function rand(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

function layouts(nodes: Node[], edges: Edge[]): Record<Layout, Float32Array> {
  const n = nodes.length, idx = new Map(nodes.map((x, i) => [x.id, i]));
  const r = rand(7);
  const pack = (xy: [number, number][]) => { const p = new Float32Array(n * 3); xy.forEach(([x, y], i) => { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = 0; }); return p; };
  const fit = (xy: [number, number][], sx = 2.5, sy = 1.2) => {
    const xs = xy.map((p) => p[0]), ys = xy.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    return xy.map(([x, y]) => [((x - x0) / (x1 - x0 || 1) - 0.5) * 2 * sx, ((y - y0) / (y1 - y0 || 1) - 0.5) * 2 * sy] as [number, number]);
  };
  const lane = (t: string) => Math.max(0, TYPES.indexOf(t));
  // time: x = creation time, y = type lane with jitter
  const ts = nodes.map((x) => Date.parse(x.createdAt));
  const time = fit(nodes.map((x, i) => [ts[i]!, -lane(x.type) + (r() - 0.5) * 0.7]));
  // type: one ring per type
  const types = [...new Set(nodes.map((x) => x.type))];
  const ty = nodes.map((x) => { const k = types.indexOf(x.type), cnt = nodes.filter((y) => y.type === x.type).length; const j = nodes.filter((y, q) => y.type === x.type && q < nodes.indexOf(x)).length;
    const cx = (k - (types.length - 1) / 2) * 1.1, a = j * 2.399, rr = 0.06 * Math.sqrt(j) * Math.min(1, 9 / Math.sqrt(cnt)); return [cx + Math.cos(a) * rr, Math.sin(a) * rr] as [number, number]; });
  // cluster: group by the largest shared entity (from same-entity edges); others by type
  const ent = new Map<string, Set<number>>();
  for (const e of edges) if (e.type === "same-entity" && e.label) { const s = ent.get(e.label) ?? new Set(); s.add(idx.get(e.from)!); s.add(idx.get(e.to)!); ent.set(e.label, s); }
  const best = new Array<string>(n).fill("");
  for (const [l, s] of [...ent].sort((a, b) => a[1].size - b[1].size)) for (const i of s) best[i] = l; // largest wins last
  for (let i = 0; i < n; i++) if (!best[i]) best[i] = `~${nodes[i]!.type}`;
  const labels = [...new Set(best)], G = Math.ceil(Math.sqrt(labels.length));
  const seen = new Map<string, number>();
  const cl = best.map((l) => { const k = labels.indexOf(l), j = seen.get(l) ?? 0; seen.set(l, j + 1); const a = j * 2.399, rr = 0.05 * Math.sqrt(j); return [(k % G) + Math.cos(a) * rr, -Math.floor(k / G) + Math.sin(a) * rr] as [number, number]; });
  // graph: small force layout (repulsion + springs on edges)
  const P = nodes.map(() => [r() - 0.5, r() - 0.5]);
  const E = edges.map((e) => [idx.get(e.from)!, idx.get(e.to)!, e.type === "same-entity" ? 0.3 : 1] as const);
  for (let it = 0; it < 260; it++) {
    const F = nodes.map(() => [0, 0]), t = 0.02 * (1 - it / 300);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const dx = P[i]![0]! - P[j]![0]!, dy = P[i]![1]! - P[j]![1]!, d2 = dx * dx + dy * dy + 1e-4, f = 0.0009 / d2; F[i]![0] += dx * f; F[i]![1] += dy * f; F[j]![0] -= dx * f; F[j]![1] -= dy * f; }
    for (const [a, b, w] of E) { const dx = P[b]![0]! - P[a]![0]!, dy = P[b]![1]! - P[a]![1]!; F[a]![0] += dx * 0.05 * w; F[a]![1] += dy * 0.05 * w; F[b]![0] -= dx * 0.05 * w; F[b]![1] -= dy * 0.05 * w; }
    for (let i = 0; i < n; i++) { F[i]![0] -= P[i]![0]! * 0.01; F[i]![1] -= P[i]![1]! * 0.01; const m = Math.hypot(F[i]![0]!, F[i]![1]!) || 1; const s = Math.min(m, t) / m; P[i]![0] += F[i]![0]! * s; P[i]![1] += F[i]![1]! * s; }
  }
  return { time: pack(time), type: pack(fit(ty)), cluster: pack(fit(cl)), graph: pack(fit(P as [number, number][])) };
}

export async function mountMap(wrap: HTMLElement, g: { nodes: Node[]; edges: Edge[] }, initial: Layout = "graph"): Promise<MapHandle> {
  const nodes = g.nodes, edges = g.edges, n = nodes.length;
  const idx = new Map(nodes.map((x, i) => [x.id, i]));
  const L = layouts(nodes, edges);
  const colors = new Uint8Array(nodes.map((x) => TONE[x.type] ?? 0));
  const cv = wrap.querySelector<HTMLCanvasElement>("#mapc")!, ov = wrap.querySelector<HTMLCanvasElement>("#mapo")!, card = wrap.querySelector<HTMLElement>("#hcard")!;
  const inst = transformium(cv, {
    count: n, seed: 3, shape: { positions: L[initial], count: n, colors },
    style: { tones: TONES.map((c) => ({ color: c, weight: 1 })), sizes: [{ weight: 1, min: 7, max: 8 }], alpha: [0.95, 1], particle: "circle", background: "transparent", sizeDepthBase: 1 },
  } as any);
  let layout = initial, hover = -1, focus = -1, pulseIds = new Set<number>(), pulseT = 0;
  const adj = nodes.map(() => new Set<number>());
  for (const e of edges) { const a = idx.get(e.from)!, b = idx.get(e.to)!; adj[a]!.add(b); adj[b]!.add(a); }
  const morph = (l: Layout) => inst.morph({ positions: L[l], count: n, colors } as any, { morph: 1.4, stagger: { order: "none" } as any });
  void morph(initial); // re-applies in node order (the initial fit sorts by x)
  const ctx = ov.getContext("2d")!;
  const scr = new Float32Array(n * 2);
  const project = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight, R = Math.min(H * 0.36, W * 0.3), p = inst.buffers.pos;
    for (let i = 0; i < n; i++) { scr[i * 2] = W / 2 + p[i * 3]! * R; scr[i * 2 + 1] = H / 2 - p[i * 3 + 1]! * R; }
  };
  const draw = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (ov.width !== Math.round(W * dpr)) { ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); project();
    const hot = focus >= 0 ? focus : hover;
    for (const e of edges) {
      const a = idx.get(e.from)!, b = idx.get(e.to)!;
      const on = hot >= 0 && (a === hot || b === hot);
      if (focus >= 0 && !on) continue;
      if (!on && layout !== "graph" && (e.type === "evidence" || e.type === "same-entity")) continue;
      ctx.strokeStyle = on ? ECOL[e.type]!.replace(/[\d.]+\)$/, ".95)") : ECOL[e.type] ?? "rgba(255,255,255,.1)";
      ctx.lineWidth = on ? 1.6 : 0.8;
      ctx.beginPath(); ctx.moveTo(scr[a * 2]!, scr[a * 2 + 1]!); ctx.lineTo(scr[b * 2]!, scr[b * 2 + 1]!); ctx.stroke();
    }
    if (focus >= 0) { ctx.fillStyle = "rgba(18,18,18,.6)"; for (let i = 0; i < n; i++) if (i !== focus && !adj[focus]!.has(i)) { ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 4, 0, 7); ctx.fill(); } }
    const t = (performance.now() - pulseT) / 1000;
    if (pulseIds.size && t < 6) for (const i of pulseIds) { const ph = (t * 1.6 + i * 0.07) % 1; ctx.strokeStyle = `rgba(184,239,168,${1 - ph})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 5 + ph * 16, 0, 7); ctx.stroke(); }
    if (pulseIds.size) for (const i of pulseIds) { ctx.fillStyle = "#B8EFA8"; ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 3.4, 0, 7); ctx.fill(); }
    if (hot >= 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(scr[hot * 2]!, scr[hot * 2 + 1]!, 8, 0, 7); ctx.stroke(); }
  };
  const off = inst.on("frame", draw);
  const pick = (ev: MouseEvent) => { const b = ov.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top; let best = -1, bd = 196;
    for (let i = 0; i < n; i++) { const d = (scr[i * 2]! - x) ** 2 + (scr[i * 2 + 1]! - y) ** 2; if (d < bd) { bd = d; best = i; } } return { best, x, y }; };
  const onMove = (ev: MouseEvent) => {
    const { best, x, y } = pick(ev); hover = best; ov.style.cursor = best >= 0 ? "pointer" : "default";
    if (best < 0) { card.style.display = "none"; return; }
    const m = nodes[best]!, rel = [...adj[best]!].length;
    card.innerHTML = `<div class="ht ${m.type}">${esc(m.type)}${m.kind ? ` · ${esc(m.kind)}` : ""}${m.severity ? ` · ${esc(m.severity)}` : ""}</div><div>${esc(m.text.length > 260 ? m.text.slice(0, 260) + "…" : m.text)}</div><div class="hk">${m.createdAt.slice(0, 10)} · ${rel} links${m.confidence != null ? ` · confidence ${m.confidence}` : ""}</div>`;
    card.style.display = "block"; card.style.left = `${Math.min(x + 14, wrap.clientWidth - 330)}px`; card.style.top = `${Math.min(y + 14, wrap.clientHeight - 140)}px`;
  };
  const onClick = (ev: MouseEvent) => { const { best } = pick(ev); focus = best === focus ? -1 : best; };
  const onLeave = () => { hover = -1; card.style.display = "none"; };
  ov.addEventListener("mousemove", onMove); ov.addEventListener("click", onClick); ov.addEventListener("mouseleave", onLeave);
  return {
    get layout() { return layout; },
    setLayout(l) { layout = l; focus = -1; void morph(l); },
    pulse(ids) { pulseIds = new Set(ids.map((i) => idx.get(i)).filter((x): x is number => x != null)); pulseT = performance.now(); },
    destroy() { off(); ov.removeEventListener("mousemove", onMove); ov.removeEventListener("click", onClick); ov.removeEventListener("mouseleave", onLeave); inst.destroy(); },
  } as MapHandle;
}
