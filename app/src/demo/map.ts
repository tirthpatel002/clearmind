// Memory map: every memory is a Transformium particle; layouts morph with particle order preserved.
// Lines, hover and focus are drawn on an overlay canvas using the same projection as the engine.
import { transformium } from "@transformium/core/engine";

export type Layout = "graph" | "time" | "type" | "cluster";
export interface MapHandle { layout: Layout; setLayout(l: Layout): void; pulse(ids: string[]): void; filter(mask: Uint8Array | null): void; destroy(): void }
interface Node { id: string; text: string; type: string; createdAt: string; kind?: string | null; severity?: string | null; confidence?: number | null; status?: string; name?: string; aliases?: string[]; fields?: Record<string, { value: unknown; sources: string[]; fetchedAt: string | null }>; memoryCount?: number; history?: number }
/** "Source: <title>, <url>" written by the demo seeder into web memories. */
export const sourceOf = (t: string) => { const m = /Source: (.*?),? (https?:\/\/[^\s)]+?)[,.)]?(?:\s|$)/.exec(t); return m ? { title: m[1]!, url: m[2]! } : null; };
const safeUrl = (u: unknown) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);
const fv = (v: unknown): string => (Array.isArray(v) ? v.map(fv).join(", ") : v && typeof v === "object" ? Object.entries(v).map(([k, x]) => `${k}: ${fv(x)}`).join(", ") : String(v ?? ""));
/** Any field whose value is an https URL, or a map of names to https URLs, renders as links (no field names are special). */
export const isLinkField = (v: unknown) => !!safeUrl(v) || (!!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).length > 0 && Object.values(v).every((u) => safeUrl(u)));
export function linksOf(f: Node["fields"], esc: (s: unknown) => string): string {
  return Object.entries(f ?? {}).filter(([, x]) => isLinkField(x.value)).flatMap(([k, x]) => (typeof x.value === "string" ? [[k, x.value]] : Object.entries(x.value as Record<string, string>)))
    .map(([k, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(k)}</a>`).join(" · ");
}
export function entityCard(m: Node, esc: (s: unknown) => string): string {
  const f = m.fields ?? {}, links = linksOf(f, esc);
  const rows = Object.entries(f).filter(([, x]) => !isLinkField(x.value)).map(([k, x]) => `<div class="ef"><span class="k">${esc(k)}</span> ${esc(fv(x.value).slice(0, 220))}${x.sources?.length ? ` <a class="src" href="${esc(safeUrl(x.sources[0]) ?? "#")}" target="_blank" rel="noopener noreferrer" title="${esc(x.sources.join("\n"))}">source${x.sources.length > 1 ? `s (${x.sources.length})` : ""}</a>` : ""}</div>`).join("");
  return `<div class="ht entity">entity${m.kind ? ` · ${esc(m.kind)}` : ""}</div><div class="en">${esc(m.name ?? m.text)}</div>${m.aliases?.length ? `<div class="hk">also ${esc(m.aliases.slice(0, 4).join(", "))}</div>` : ""}${links ? `<div class="pl">${links}</div>` : ""}${rows}<div class="hk">${m.memoryCount ?? 0} linked memories${m.history ? ` · ${m.history} superseded field values` : ""}</div><button class="btn research sm" data-act="research" data-q="${esc(m.name ?? m.text)}" data-e="${esc(m.id)}" title="Search the public web once (1 Tavily credit) and remember what it finds, linked to this entity">Research</button>`;
}
interface Edge { from: string; to: string; type: string; label?: string }

const TYPES = ["memory", "superseded", "insight", "security", "security-flag", "agent-run"];
const TONE: Record<string, number> = { memory: 0, superseded: 1, insight: 2, security: 3, "security-flag": 3, "agent-run": 4, entity: 6, web: 7 };
const TONES = ["rgb(159,214,255)", "rgb(107,112,121)", "rgb(199,166,255)", "rgb(255,107,87)", "rgb(255,209,102)", "rgb(46,48,54)", "rgb(76,154,255)", "rgb(255,159,67)"];
const DIM = 5;
const ECOL: Record<string, string> = { supersedes: "rgba(160,160,160,.55)", evidence: "rgba(199,166,255,.45)", "fixed-by": "rgba(120,230,140,.8)", "same-signature": "rgba(255,140,120,.6)", "same-entity": "rgba(159,214,255,.16)", "co-used": "rgba(255,209,102,.5)", relation: "rgba(76,154,255,.45)" };
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
  let layout = initial, hover = -1, hoverEdge = -1, focus = -1, pulseIds = new Set<number>(), pulseT = 0;
  const adj = nodes.map(() => new Set<number>());
  for (const e of edges) { const a = idx.get(e.from)!, b = idx.get(e.to)!; adj[a]!.add(b); adj[b]!.add(a); }
  let mask: Uint8Array | null = null;
  const hubs = nodes.map((x, i) => (x.type === "entity" ? i : -1)).filter((i) => i >= 0);
  const target = (l: Layout) => {
    if (!mask) return L[l];
    // matches keep their place; the rest drift outward so the filtered set reads as the live graph
    const p = Float32Array.from(L[l]);
    for (let i = 0; i < n; i++) if (!mask[i]) { p[i * 3] *= 1.45; p[i * 3 + 1] *= 1.45; }
    return p;
  };
  // non-matches are recoloured to a dark tone in the particle engine itself, so the dimming is unmistakable
  const tint = () => (mask ? colors.map((c, i) => (mask![i] ? c : DIM)) : colors);
  const morph = (l: Layout, sec = 1.4) => inst.morph({ positions: target(l), count: n, colors: tint() } as any, { morph: sec, travel: sec * 0.8, stagger: { order: "none" } as any });
  void morph(initial); // re-applies in node order (the initial fit sorts by x)
  const ctx = ov.getContext("2d")!;
  const scr = new Float32Array(n * 2);
  // view transform (zoom about cursor + pan), shared with the engine camera so both layers stay aligned
  let vz = 1, vx = 0, vy = 0;
  const cam = (inst as any).camera;
  const applyView = () => { cam?.set?.({ zoom: vz, offset: [vx, vy] }); };
  const zoomAt = (px: number, py: number, f: number) => {
    const W = wrap.clientWidth, H = wrap.clientHeight, nz = Math.min(6, Math.max(0.5, vz * f)), k = nz / vz;
    // keep the world point under (px,py) fixed: p = c + o + w*z
    vx = px - W / 2 - (px - W / 2 - vx) * k; vy = py - H / 2 - (py - H / 2 - vy) * k; vz = nz; applyView();
  };
  const resetView = () => { vz = 1; vx = 0; vy = 0; applyView(); };
  const project = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight, R = Math.min(H * 0.36, W * 0.3) * vz, p = inst.buffers.pos, cx = W / 2 + vx, cy = H / 2 + vy;
    for (let i = 0; i < n; i++) { scr[i * 2] = cx + p[i * 3]! * R; scr[i * 2 + 1] = cy - p[i * 3 + 1]! * R; }
  };
  const draw = () => {
    const W = wrap.clientWidth, H = wrap.clientHeight, dpr = Math.min(2, devicePixelRatio || 1);
    if (ov.width !== Math.round(W * dpr)) { ov.width = Math.round(W * dpr); ov.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); project();
    const hot = focus >= 0 ? focus : hover;
    for (let k = 0; k < edges.length; k++) {
      const e = edges[k]!, a = idx.get(e.from)!, b = idx.get(e.to)!;
      const on = hot >= 0 && (a === hot || b === hot);
      if (focus >= 0 && !on) continue;
      if (mask && !on && !(mask[a] && mask[b])) continue;
      if (!on && layout !== "graph" && (e.type === "evidence" || e.type === "same-entity")) continue;
      const ec = ECOL[e.type] ?? "rgba(255,255,255,.1)";
      ctx.strokeStyle = on ? ec.replace(/[\d.]+\)$/, ".95)") : ec;
      ctx.lineWidth = k === hoverEdge ? 3.4 : on ? 1.6 : 0.8;
      if (k === hoverEdge) ctx.strokeStyle = ec.replace(/[\d.]+\)$/, "1)");
      ctx.beginPath(); ctx.moveTo(scr[a * 2]!, scr[a * 2 + 1]!); ctx.lineTo(scr[b * 2]!, scr[b * 2 + 1]!); ctx.stroke();
    }
    if (mask && focus < 0) {
      ctx.fillStyle = "rgba(18,18,18,.82)"; for (let i = 0; i < n; i++) if (!mask[i]) { ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 6, 0, 7); ctx.fill(); }
      // matches glow: soft halo plus a ring (blue for text, lavender for semantic-only)
      const tt = performance.now() / 1000;
      for (let i = 0; i < n; i++) if (mask[i]) {
        const x = scr[i * 2]!, y = scr[i * 2 + 1]!, sem = mask[i] === 2, g = ctx.createRadialGradient(x, y, 2, x, y, 18);
        g.addColorStop(0, sem ? "rgba(199,166,255,.55)" : "rgba(76,154,255,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 18, 0, 7); ctx.fill();
        ctx.strokeStyle = sem ? "rgba(199,166,255,.95)" : "rgba(76,154,255,.95)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8 + Math.sin(tt * 3 + i) * 1.2, 0, 7); ctx.stroke();
      }
    }
    // entity hubs: bigger discs with a name label
    ctx.font = "600 11px Inter, system-ui, sans-serif"; ctx.textAlign = "center";
    for (const i of hubs) {
      const dim = !!(mask && !mask[i]);
      const x = scr[i * 2]!, y = scr[i * 2 + 1]!, r = 6 + Math.min(8, Math.sqrt(nodes[i]!.memoryCount ?? 1) * 1.6);
      ctx.fillStyle = dim ? "rgba(46,48,54,.9)" : "rgba(76,154,255,.95)"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.strokeStyle = dim ? "rgba(0,0,0,.4)" : "rgba(10,28,56,.9)"; ctx.lineWidth = 1.5; ctx.stroke();
      if (!dim && (layout === "cluster" || nodes[i]!.memoryCount! >= 3 || mask)) { ctx.fillStyle = "rgba(236,244,255,.95)"; ctx.fillText(nodes[i]!.name ?? "", x, y - r - 4); }
    }
    if (focus >= 0) { ctx.fillStyle = "rgba(18,18,18,.6)"; for (let i = 0; i < n; i++) if (i !== focus && !adj[focus]!.has(i) && nodes[i]!.type !== "entity") { ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 4, 0, 7); ctx.fill(); } }
    const t = (performance.now() - pulseT) / 1000;
    if (pulseIds.size && t < 6) for (const i of pulseIds) { const ph = (t * 1.6 + i * 0.07) % 1; ctx.strokeStyle = `rgba(76,154,255,${1 - ph})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 5 + ph * 16, 0, 7); ctx.stroke(); }
    if (pulseIds.size) for (const i of pulseIds) { ctx.fillStyle = "#4c9aff"; ctx.beginPath(); ctx.arc(scr[i * 2]!, scr[i * 2 + 1]!, 3.4, 0, 7); ctx.fill(); }
    if (hot >= 0) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(scr[hot * 2]!, scr[hot * 2 + 1]!, 8, 0, 7); ctx.stroke(); }
  };
  const off = inst.on("frame", draw);
  const pick = (ev: MouseEvent) => { const b = ov.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top; let best = -1, bd = 196;
    for (let i = 0; i < n; i++) { const d = (scr[i * 2]! - x) ** 2 + (scr[i * 2 + 1]! - y) ** 2; if (d < bd) { bd = d; best = i; } } return { best, x, y }; };
  let drag: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null, justDragged = false;
  const onDown = (ev: MouseEvent) => { if (ev.button !== 0) return; if (pick(ev).best >= 0) return; drag = { x: ev.clientX, y: ev.clientY, vx, vy, moved: false }; };
  const onDragMove = (ev: MouseEvent) => { if (!drag) return; const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
    if (!drag.moved && dx * dx + dy * dy < 16) return; drag.moved = true; vx = drag.vx + dx; vy = drag.vy + dy; applyView(); ov.style.cursor = "grabbing"; hover = -1; showPinned(); };
  const onUp = () => { if (drag?.moved) { justDragged = true; setTimeout(() => (justDragged = false), 0); ov.style.cursor = "default"; } drag = null; };
  const onWheel = (ev: WheelEvent) => { ev.preventDefault(); const b = ov.getBoundingClientRect(), x = ev.clientX - b.left, y = ev.clientY - b.top;
    const unit = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
    // ctrl+wheel = trackpad pinch (or ctrl+mouse wheel); a plain mouse wheel (line mode or large steps) zooms; small two-finger scroll pans
    const isMouse = ev.deltaMode !== 0 || (ev.deltaX === 0 && Math.abs(ev.deltaY) >= 50 && Number.isInteger(ev.deltaY));
    if (ev.ctrlKey || isMouse) zoomAt(x, y, Math.exp(-ev.deltaY * unit * (ev.ctrlKey ? 0.01 : 0.0015)));
    else { vx -= ev.deltaX * unit; vy -= ev.deltaY * unit; applyView(); }
    hover = -1; if (!drag) onMove(ev); };
  const onDbl = (ev: MouseEvent) => { if (pick(ev).best < 0) resetView(); };
  const EWORD: Record<string, string> = { supersedes: "supersedes", evidence: "evidence", "fixed-by": "fixed by", "same-signature": "same signature", "same-entity": "same entity", "co-used": "used together", relation: "relation" };
  const snip = (i: number) => { const m = nodes[i]!; const t = m.type === "entity" ? (m.name ?? m.text) : m.text; return t.length > 90 ? t.slice(0, 90) + "…" : t; };
  const kindOf = (i: number) => { const m = nodes[i]!; return m.type + (m.kind ? ` · ${m.kind}` : ""); };
  // edges of the focused node only, nearest segment within 6px in screen space (post zoom/pan)
  const pickEdge = (x: number, y: number) => { if (focus < 0) return -1; let best = -1, bd = 36;
    for (let k = 0; k < edges.length; k++) { const e = edges[k]!, a = idx.get(e.from)!, b = idx.get(e.to)!; if (a !== focus && b !== focus) continue;
      const ax = scr[a * 2]!, ay = scr[a * 2 + 1]!, dx = scr[b * 2]! - ax, dy = scr[b * 2 + 1]! - ay, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      const d = (ax + t * dx - x) ** 2 + (ay + t * dy - y) ** 2; if (d < bd) { bd = d; best = k; } } return best; };
  const otherEnd = (k: number) => { const e = edges[k]!, a = idx.get(e.from)!, b = idx.get(e.to)!; return a === focus ? b : a; };
  const edgeCard = (k: number, x: number, y: number) => {
    const e = edges[k]!, o = otherEnd(k), a = idx.get(e.from)!, b = idx.get(e.to)!;
    const word = (EWORD[e.type] ?? e.type.replace(/-/g, " ")) + (e.label && e.type !== "same-entity" ? `: ${e.label}` : e.type === "same-entity" && e.label ? ` (${e.label})` : "");
    card.classList.remove("pinned"); card.classList.add("edge");
    card.innerHTML = `<div class="ht">link · ${esc(word)}</div><div class="en">${esc(snip(o))}</div><div class="hk">${esc(kindOf(o))}</div><div class="ends"><span>${esc(snip(a).slice(0, 40))}</span> → <span>${esc(snip(b).slice(0, 40))}</span></div><div class="hk">click to focus this node</div>`;
    card.style.display = "block"; card.style.left = `${Math.min(x + 14, wrap.clientWidth - 330)}px`; card.style.top = `${Math.min(y + 14, wrap.clientHeight - 140)}px`;
  };
  const onMove = (ev: MouseEvent, force = -1) => {
    if (drag?.moved) return;
    card.classList.remove("edge");
    const { best: b0, x, y } = pick(ev); const best = force >= 0 ? force : mask && b0 >= 0 && !mask[b0] ? -1 : b0; hover = best; ov.style.cursor = best >= 0 ? "pointer" : "default";
    hoverEdge = best < 0 && force < 0 ? pickEdge(x, y) : -1;
    if (hoverEdge >= 0) { ov.style.cursor = "pointer"; edgeCard(hoverEdge, x, y); return; }
    if (best < 0) { showPinned(); return; }
    const m = nodes[best]!, rel = [...adj[best]!].length;
    card.classList.toggle("pinned", pinned >= 0 && best === pinned);
    if (m.type === "entity") { card.innerHTML = entityCard(m, esc); }
    else card.innerHTML = `<div class="ht ${m.type}">${esc(m.type)}${m.kind ? ` · ${esc(m.kind)}` : ""}${m.severity ? ` · ${esc(m.severity)}` : ""}</div><div>${esc(m.text.length > 260 ? m.text.slice(0, 260) + "…" : m.text)}</div>${(() => { const s = m.type === "web" ? sourceOf(m.text) : null; return s ? `<div class="webline"><span class="badge web">web</span> Public web data gathered by the demo seeder via Tavily: <a href="${esc(safeUrl(s.url) ?? "#")}" target="_blank" rel="noopener noreferrer" title="${esc(s.url)}">${esc(s.title.slice(0, 60))}</a></div>` : ""; })()}<div class="hk">${m.createdAt.slice(0, 10)} · ${rel} links${m.confidence != null ? ` · confidence ${m.confidence}` : ""}</div>`;
    card.style.display = "block"; card.style.left = `${Math.min(x + 14, wrap.clientWidth - 330)}px`; card.style.top = `${Math.min(y + 14, wrap.clientHeight - 140)}px`;
  };
  // clicking an entity pins its card so the profile and source links can be clicked
  let pinned = -1, pinHtml = "", pinL = "", pinT = "";
  const showPinned = () => { if (pinned < 0) { card.style.display = "none"; card.classList.remove("pinned"); return; } card.innerHTML = pinHtml; card.style.left = pinL; card.style.top = pinT; card.classList.add("pinned"); card.style.display = "block"; };
  const clear = () => { focus = -1; hoverEdge = -1; pinned = -1; hover = -1; showPinned(); };
  const onClick = (ev: MouseEvent) => { if (justDragged) return; const { best: b0, x, y } = pick(ev);
    const ek = b0 < 0 ? pickEdge(x, y) : -1; const best = ek >= 0 ? otherEnd(ek) : b0; hoverEdge = -1; if (ek >= 0) { focus = -1; pinned = -1; } if (best < 0 || best === focus) { clear(); onMove(ev); return; }
    focus = best; pinned = nodes[best]!.type === "entity" ? best : -1; onMove(ev, ek >= 0 ? best : -1); if (pinned >= 0) { pinHtml = card.innerHTML; pinL = card.style.left; pinT = card.style.top; card.classList.add("pinned"); } };
  // leaving the map clears focus, except when moving onto the pinned card to click its links
  const onLeave = (ev: MouseEvent) => { if (pinned >= 0 && ev.relatedTarget instanceof Node && card.contains(ev.relatedTarget)) { hover = -1; showPinned(); return; } clear(); };
  const onCardLeave = (ev: MouseEvent) => { if (pinned >= 0 && !(ev.relatedTarget instanceof Node && ov.contains(ev.relatedTarget))) clear(); };
  const onKey = (ev: KeyboardEvent) => { if (ev.key === "Escape") clear(); };
  const rb = wrap.querySelector<HTMLElement>("#mapreset"); rb?.addEventListener("click", resetView);
  ov.addEventListener("mousedown", onDown); addEventListener("mousemove", onDragMove); addEventListener("mouseup", onUp); ov.addEventListener("wheel", onWheel, { passive: false }); ov.addEventListener("dblclick", onDbl);
  ov.addEventListener("mousemove", onMove); ov.addEventListener("click", onClick); ov.addEventListener("mouseleave", onLeave); card.addEventListener("mouseleave", onCardLeave); addEventListener("keydown", onKey);
  return {
    get layout() { return layout; },
    setLayout(l) { layout = l; focus = -1; resetView(); void morph(l); },
    filter(m) { mask = m; void morph(layout, 0.6); },
    pulse(ids) { pulseIds = new Set(ids.map((i) => idx.get(i)).filter((x): x is number => x != null)); pulseT = performance.now(); },
    destroy() { off(); rb?.removeEventListener("click", resetView); ov.removeEventListener("mousedown", onDown); removeEventListener("mousemove", onDragMove); removeEventListener("mouseup", onUp); ov.removeEventListener("wheel", onWheel); ov.removeEventListener("dblclick", onDbl); ov.removeEventListener("mousemove", onMove); ov.removeEventListener("click", onClick); ov.removeEventListener("mouseleave", onLeave); card.removeEventListener("mouseleave", onCardLeave); removeEventListener("keydown", onKey); inst.destroy(); },
  } as MapHandle;
}
