// Clearmind hackathon demo UI: three tabs (Chat, Memory, Insights), a context-aware composer in the bottom notch,
// and a slide-out Inspector (recall details, live latency, credits ledger, eval numbers) openable from anywhere.
import "./demo.css";
import "./tenancy.css";
import { initTenancy } from "./tenancy.js";
import { splitMem, memLine } from "./memtext.js";
import { mountMap, sourceOf, linksOf, type MapHandle, type Layout } from "./map.js";

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector(s) as T;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const usd = (n: number) => (n = typeof n === "number" && Number.isFinite(n) ? n : 0, n === 0 ? "$0" : Math.abs(n) < 0.0001 ? `$${n.toFixed(8)}` : Math.abs(n) < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(4)}`);
const short = (id: string) => String(id ?? "").slice(-6);
const ist = (iso: string) => !iso || isNaN(Date.parse(iso)) ? "" : new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
/** API origin: VITE_API_BASE at build time, or <meta name="clearmind-api" content="https://api.example"> at deploy time; empty = same origin. */
const API_BASE = (document.querySelector<HTMLMetaElement>('meta[name="clearmind-api"]')?.content || (import.meta as any).env?.VITE_API_BASE || "").replace(/\/$/, "");
async function api(path: string, body?: unknown): Promise<any> {
  const init: RequestInit = { credentials: API_BASE ? "include" : "same-origin", ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) };
  const r = await fetch(API_BASE + path, init);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { reauth(); throw new Error("Your session expired. Pick who you are to continue."); }
  if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j;
}

const chipHtml = (raw: unknown) => { const c = splitMem(raw).chip; return c ? ` <span class="mchip" title="${esc(c)}">${esc(c)}</span>` : ""; };
/** Row text: the real content first (clamped by CSS), then a muted source chip. Full text stays in the detail view. */
const memHtml = (raw: unknown) => `<span class="mbody">${esc(splitMem(raw).body)}</span>${chipHtml(raw)}`;
let reauthing = false;
/** Session lost (e.g. server restart): reopen the "Continue as" picker instead of leaving the UI stuck. */
function reauth() { if (reauthing) return; reauthing = true; void initTenancy(API_BASE, true).finally(() => { reauthing = false; }); }
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const errBox = (what: string, e: unknown) => `<div class="bub refused">Could not load ${esc(what)}: ${esc((e as Error)?.message ?? String(e))} <a href="#" class="dlink" data-act="retry">Retry</a></div>`;

/** Minimal safe markdown: input is escaped first, then only bold/italic/code/lists/line breaks are turned into tags. */
export function md(src: string): string {
  src = String(src ?? "");
  const inline = (t: string) => esc(t)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(?=\S)([^*]+?)\*\*/g, "<b>$1</b>").replace(/__(?=\S)([^_]+?)__/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*(?=\S)([^*]+?)\*(?!\w)/g, "$1<i>$2</i>").replace(/(^|[^_\w])_(?=\S)([^_]+?)_(?!\w)/g, "$1<i>$2</i>");
  const out: string[] = []; let list: "ul" | "ol" | null = null; let para: string[] = [];
  const flushP = () => { if (para.length) { out.push(`<p>${para.join("<br>")}</p>`); para = []; } };
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of src.replace(/\r/g, "").split("\n")) {
    const line = raw.trimEnd(), ul = /^\s*[-*•]\s+(.*)$/.exec(line), ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) { flushP(); const want = ul ? "ul" : "ol"; if (list !== want) { close(); out.push(`<${want}>`); list = want; } out.push(`<li>${inline((ul ?? ol)![1]!)}</li>`); continue; }
    if (!line.trim()) { flushP(); close(); continue; }
    close(); para.push(inline(line));
  }
  flushP(); close();
  return out.join("");
}

type Tab = "chat" | "memory" | "insights";
type MemView = "map" | "list" | "changed" | "privacy";
const TABS: [Tab, string][] = [["chat", "Chat"], ["memory", "Memory"], ["insights", "Insights"]];
const PH: Record<string, string> = {
  chat: "Ask your memory...",
  map: "Filter memories: words, dates, or type:security, type:insight...",
  list: "Filter memories: words, dates, or type:agent-run...",
  changed: "Filter changed facts...",
  privacy: "Filter memories to redact or forget...",
  insights: "Filter insights: words, kind:failure, severity:high...",
};
const S = {
  seed: null as any,
  tab: "chat" as Tab, mem: "map" as MemView, chat: [] as any[], cfg: null as any, session: `s-${Date.now().toString(36)}`, busy: false,
  texts: new Map<string, string>(), map: null as MapHandle | null, layout: "graph" as Layout, lastUsed: [] as string[], reflecting: false,
  q: { chat: "", memory: "", insights: "" } as Record<Tab, string>, showAll: false, sel: -1, filterMs: [] as number[],
  graph: null as any, privacy: null as any, pvShown: 200, hay: [] as string[], insights: null as any, maskSig: "", insOrder: new Map<any, number>(),
};

// ---------- semantic half of the composer search (Memory + Insights only; Chat recall stays on Nebius Qwen3) ----------
// The query is embedded on the server (nomic-embed-text-v1.5, kept warm); no model is downloaded to the browser.
const SEM_DEBOUNCE = 250, SEM_BAND = 0.06, SEM_Z = 1.6, SEM_MAX = 10, SEM_MINK = 3, SEM_FLOOR = 0.62;
/** Relative cutoff: nomic scores are flat (~0.5-0.7 for everything), so keep hits near the top AND well above the mean. */
export function semPick(cos: Map<string, number>): string[] {
  const xs = [...cos].sort((a, b) => b[1] - a[1]); if (!xs.length) return [];
  const v = xs.map((x) => x[1]), mean = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length) || 1;
  const top = v[0]!, z = (c: number) => (c - mean) / sd;
  if (top < SEM_FLOOR) return []; // nothing is actually about this (gibberish tops out ~0.52, unrelated topics ~0.6)
  let keep = xs.filter(([, c]) => c >= top - SEM_BAND && z(c) >= SEM_Z).slice(0, SEM_MAX);
  if (keep.length < SEM_MINK && z(top) >= 2) keep = xs.slice(0, SEM_MINK);
  return keep.map((x) => x[0]);
}
const SEM = {
  res: null as { key: string; cos: Map<string, number>; hits: Set<string> } | null, pending: "" as string, seq: 0, timer: 0 as any,
  cache: new Map<string, Float32Array | Map<string, number>>(), inflight: new Map<string, Promise<any>>(),
  lat: [] as { ms: number; cached: boolean; embedMs: number; path: string }[], err: "",
};
const semKey = () => parseQ(S.q[S.tab] ?? "").words.join(" ");
async function semServer(key: string) {
  const r = await api(`/api/demo/semantic?q=${encodeURIComponent(key)}`);
  return { cos: new Map<string, number>(r.hits.map((h: any) => [h.id, h.cos])), embedMs: r.embedMs as number, path: "server" as const };
}
/** Query -> cosine per item id. Embedded on the server (nomic-embed-text-v1.5, kept warm).
 *  Cached per query; identical in-flight calls share one promise. */
function semQuery(key: string): Promise<{ cos: Map<string, number>; embedMs: number; cached: boolean; path: string }> {
  const hit = SEM.cache.get(key) as any;
  if (hit) return Promise.resolve({ ...hit, embedMs: 0, cached: true });
  const fl = SEM.inflight.get(key); if (fl) return fl;
  const p = (async () => {
    let r: { cos: Map<string, number>; embedMs: number; path: string };
    r = await semServer(key);
    SEM.cache.set(key, { cos: r.cos, path: r.path } as any); if (SEM.cache.size > 300) SEM.cache.delete(SEM.cache.keys().next().value!);
    return { ...r, cached: false };
  })();
  SEM.inflight.set(key, p); p.finally(() => SEM.inflight.delete(key));
  return p;
}
function semSchedule(now = false) {
  clearTimeout(SEM.timer);
  const key = semKey();
  if (!key) { SEM.res = null; SEM.pending = ""; return; }
  if (SEM.res?.key === key) return;
  SEM.timer = setTimeout(() => void semRun(key), now ? 0 : SEM_DEBOUNCE);
}
async function semRun(key: string) {
  const my = ++SEM.seq; SEM.pending = key; applyFilter();
  const t0 = performance.now();
  try {
    const r = await semQuery(key);
    const ms = performance.now() - t0;
    SEM.lat.push({ ms, cached: r.cached, embedMs: r.embedMs, path: r.cached ? "cache" : r.path }); SEM.err = ""; if (SEM.lat.length > 500) SEM.lat.shift();
    if (semKey() !== key) { if (my === SEM.seq) SEM.pending = ""; return; } // only drop answers for text no longer in the box; the response for the current text always lands
    SEM.res = { key, cos: r.cos, hits: new Set(semPick(r.cos)) };
  } catch (e) { SEM.err = (e as Error).message || "unknown error"; console.warn("semantic search failed:", SEM.err); }
  if (SEM.pending === key) SEM.pending = "";
  applyFilter();
}

// ---------- filtering (client-side, no network) ----------
interface Q { words: string[]; fields: [string, string][] }
function parseQ(s: string): Q {
  const words: string[] = [], fields: [string, string][] = [];
  for (const t of s.toLowerCase().split(/\s+/).filter(Boolean)) { const m = /^(type|kind|severity|sev|status):(.+)$/.exec(t); m ? fields.push([m[1] === "sev" ? "severity" : m[1]!, m[2]!]) : words.push(t); }
  return { words, fields };
}
const matches = (q: Q, hay: string, attrs: Record<string, string | null | undefined>) =>
  q.words.every((w) => hay.includes(w)) && q.fields.every(([k, v]) => (attrs[k] ?? "").toLowerCase().startsWith(v));

function applyFilter() {
  if (S.tab === "memory" && S.mem === "list") return;
  const t0 = performance.now();
  const q = parseQ(S.q[S.tab] ?? ""), empty = !q.words.length && !q.fields.length;
  const key = q.words.join(" "), sem = key && SEM.res?.key === key ? SEM.res : null;
  let shown = 0, total = 0, semOnly = 0;
  if (S.tab === "memory" && S.mem === "map" && S.graph) {
    const nodes = S.graph.nodes as any[]; total = nodes.length;
    const mask = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      const x = nodes[i], attrs = { type: x.type, kind: x.kind, severity: x.severity, status: x.status };
      if (empty || matches(q, S.hay[i]!, attrs)) { mask[i] = 1; shown++; }
      else if (sem?.hits.has(x.id) && q.fields.every(([k, v]) => ((attrs as any)[k] ?? "").toLowerCase().startsWith(v))) { mask[i] = 2; shown++; semOnly++; }
    }
    const sig = empty ? "" : Array.from(mask).join("");
    if (sig !== S.maskSig) { S.maskSig = sig; S.map?.filter(empty ? null : mask); }
  } else {
    const rows = [...document.querySelectorAll<HTMLElement>("[data-f]")]; total = rows.length;
    const score = new Map<HTMLElement, number>();
    for (const r of rows) {
      const attrs = { type: r.dataset.type, kind: r.dataset.kind, severity: r.dataset.sev, status: r.dataset.status };
      const txt = empty || matches(q, r.dataset.f!, attrs);
      const sOnly = !txt && !!sem && sem.hits.has(r.dataset.id ?? "") && q.fields.every(([k, v]) => ((attrs as any)[k] ?? "").toLowerCase().startsWith(v));
      const ok = txt || sOnly;
      r.hidden = !ok || (empty && r.dataset.more === "1");
      r.classList.toggle("semonly", sOnly);
      if (ok) { shown++; if (sOnly) semOnly++; }
      score.set(r, !ok ? -9 : sem ? (sem.cos.get(r.dataset.id ?? "") ?? 0) + (txt ? 0.15 : 0) : -Number(r.dataset.o ?? 0) / 1e4);
    }
    // re-rank in place when semantic scores are in; otherwise keep the original order
    const parent = rows[0]?.parentElement;
    if (parent && rows.every((r) => r.parentElement === parent)) {
      const want = sem ? [...rows].sort((x, y) => score.get(y)! - score.get(x)!) : [...rows].sort((x, y) => Number(x.dataset.o) - Number(y.dataset.o));
      if (want.some((r, i) => r !== rows[i])) { const anchor = rows[rows.length - 1]!.nextSibling; for (const r of want) parent.insertBefore(r, anchor); }
    }
  }
  const ms = performance.now() - t0;
  if (!empty) { S.filterMs.push(ms); if (S.filterMs.length > 500) S.filterMs.shift(); }
  const c = document.getElementById("count");
  if (!c) return;
  const semTxt = !key ? "" : SEM.pending === key ? `<span class="sem k pend">semantic…</span>`
    : sem ? `<span class="k">text ${shown - semOnly} · semantic +${semOnly}</span>` : SEM.err ? `<span class="sem err">semantic search unavailable: ${esc(SEM.err)}</span>` : "";
  // never a silent blank: say what is happening when nothing matches
  const host = document.getElementById("content");
  let msg = document.getElementById("semmsg");
  const need = !empty && shown === 0 && !!key;
  if (need && host) {
    if (!msg) { msg = document.createElement("div"); msg.id = "semmsg"; msg.className = "semmsg"; (host.querySelector(".list") ?? host.querySelector("#mapwrap") ?? host).insertAdjacentElement("beforebegin", msg); }
    msg.innerHTML = SEM.pending === key || (!sem && !SEM.err) ? "No text matches yet. Searching by meaning…" : SEM.err ? `No text matches, and semantic search unavailable: ${esc(SEM.err)}` : "No matches by text or meaning. Everything is dimmed.";
  } else msg?.remove();
  c.innerHTML = empty ? `${total} ${S.tab === "insights" ? "insights" : "memories"}`
    : `<b>${shown}</b> of ${total} match ${semTxt} <span class="k">· text ${ms.toFixed(2)} ms</span>`;
}

// ---------- header / tabs ----------
function renderTabs() {
  $("#tabs").innerHTML = TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" class="${S.tab === k ? "on" : ""}">${l}</button>`).join("");
  const key = S.tab === "memory" ? S.mem : S.tab;
  const inp = $<HTMLInputElement>("#q"); inp.placeholder = PH[key]!; inp.value = S.q[S.tab] ?? "";
  $(".send").innerHTML = S.tab === "chat" ? "&#10148;" : "&#8981;";
}
function renderWallet(w = S.cfg?.wallet) {
  if (!w) return;
  const p = $("#creditsPill");
  p.innerHTML = `Demo credits <b>$${num(w.balanceUsd).toFixed(4)}</b>`;
  p.classList.toggle("low", num(w.balanceUsd) < (S.cfg?.minBalance ?? 0.005));
}
function go(t: Tab) { if (t !== S.tab) { stopList(); S.tab = t; renderTabs(); void render(); } }

// ---------- chat ----------
function answerHtml(r: any) {
  const n = new Map<string, number>(); (r.cited ?? []).forEach((c: any, i: number) => n.set(c.id, i + 1));
  if (r.abstained) return `<p>I don't know. <span class="k">Nothing in memory supports an answer.</span></p>`;
  const marks: string[] = [];
  const text = String(r.answer ?? "").replace(/\s*\[([0-9A-Z]{10,})\]/g, (_: string, id: string) => { marks.push(id); return `\u0000${marks.length - 1}\u0000`; });
  return md(text).replace(/\u0000(\d+)\u0000/g, (_, k) => { const id = marks[Number(k)]!; return `<sup class="mk" data-mem="${id}" title="${esc(S.texts.has(id) ? memLine(S.texts.get(id), 300) + (splitMem(S.texts.get(id)).chip ? ` (${splitMem(S.texts.get(id)).chip})` : "") : "memory")}">${n.get(id) ?? "&middot;"}</sup>`; });
}
function webSources(r: any) {
  const seen = new Set<string>(), xs = (r.cited ?? []).map((c: any) => sourceOf(c.text)).filter((s: any) => s && !seen.has(s.url) && seen.add(s.url));
  return xs.length ? `<div class="srcs"><span class="badge web">web</span> Sources: ${xs.slice(0, 6).map((s: any) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.url)}">${esc(String(s.title ?? s.url).slice(0, 48))}</a>`).join(" · ")}</div>` : "";
}
function chatItem(m: any, idx: number): string {
  if (m.role === "user") return `<div class="msg user"><span>${esc(m.q)}</span></div>`;
  if (m.pending) return `<div class="msg"><div class="bub spin">${m.slow ? "Searching memory" : "Thinking"}<span class="dots"><i></i><i></i><i></i></span></div></div>`;
  if (m.error) return `<div class="msg"><div class="bub refused">${esc(m.error)}</div></div>`;
  if (m.research) return researchItem(m.research);
  const r = m.r; if (!r) return "";
  if (r.refused) return `<div class="msg"><div class="bub refused"><p>${esc(r.reason)}</p><button class="btn dark" data-act="topup">Top up $5.00 demo credits</button></div></div>`;
  return `<div class="msg"><div class="bub ${r.abstained ? "abst" : ""}"><div class="ans">${answerHtml(r)}</div>${researchLine(r.research)}${webSources(r)}${(r.abstained || r.lowConfidence) && r.research?.reason === "off" ? researchBtn(S.chat[idx - 1]?.q ?? "") : ""}<a href="#" class="dlink" data-act="inspect" data-i="${idx}">Details</a></div></div>`;
}
/** Offered, never auto-run: one click = one Tavily basic search (1 credit) + one distil call on the configured model. */
export const researchBtn = (q: string, entityId = "", label = "Research &amp; remember") =>
  `<button class="btn research" data-act="research" data-q="${esc(q)}" data-e="${esc(entityId)}" title="Searches the public web once (1 Tavily credit) and saves what it finds as memories with source links">${label}</button>`;
const LIMIT_REASONS = new Set(["user_minute", "user_day", "workspace_day"]);
/** Under a chat answer: what live research did (sources visible), or clearly why it did not run. */
function researchLine(x: any): string {
  if (!x) return "";
  if (x.ran || x.reused) {
    const src = (x.sources ?? []).slice(0, 6).map((s: any) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.url)}">${esc(String(s.title ?? s.url).slice(0, 40))}</a>`).join(" · ");
    return `<div class="rline"><span class="badge web">web</span> ${x.ran ? `Researched live with Tavily · ${(x.memories ?? []).length} new ${(x.memories ?? []).length === 1 ? "memory" : "memories"} saved` : `Used ${(x.memories ?? []).length} memories researched earlier`}${src ? ` · ${src}` : ""}</div>`;
  }
  if (LIMIT_REASONS.has(x.reason)) return `<div class="rline limit">${esc(x.note)} Answering from memory only.</div>`;
  if (x.reason === "error") return `<div class="rline k">Live research failed; answering from memory only.</div>`;
  return "";
}
async function openCredits() {
  const d = $("#drawer"); S.sel = -2; d.classList.add("on"); d.innerHTML = '<p class="k">Loading…</p>';
  try {
    const c = await api("/api/research/credits");
    const bar = (u: number, cap: number) => `<div class="rbar"><i style="width:${Math.min(100, Math.round((u / Math.max(1, cap)) * 100))}%"></i></div>`;
    d.innerHTML = `<div class="dh"><b>Research credits</b><button class="btn sm" data-act="close">Close</button></div>
      <section><p class="k">Live web research (Tavily basic search, 1 credit each). ${c.configured ? (c.auto ? "Runs automatically when memory can't answer." : "Automatic research is off.") : "Not configured on this server."}</p>
      <h4>Workspace today</h4><p><b>${c.workspace.used}</b> used · <b>${Math.max(0, c.workspace.cap - c.workspace.used)}</b> left of ${c.workspace.cap}</p>${bar(c.workspace.used, c.workspace.cap)}
      <h4>You (${esc(c.user.id)})</h4><p><b>${c.user.used}</b> used · <b>${Math.max(0, c.user.dayCap - c.user.used)}</b> left of ${c.user.dayCap} today · max ${c.user.minuteCap}/min</p>${bar(c.user.used, c.user.dayCap)}
      <p>${c.users == null ? '<span class="k">Workspace user count not available.</span>' : `<b>${c.users}</b> users in this workspace <span class="k">(${esc(c.usersCounted)})</span>`}</p>
      ${c.perViewer ? `<table><tr><th>viewer</th><th>used today</th></tr>${c.perViewer.map((p: any) => `<tr><td>${esc(p.viewer)}</td><td class="n">${p.used}</td></tr>`).join("") || '<tr><td colspan=2 class="k">No research yet today.</td></tr>'}</table>` : ""}</section>`;
  } catch (e) { d.innerHTML = `<div class="bub refused">${esc((e as Error).message)}</div>`; }
}
function researchItem(r: any): string {
  if (r.pending) return `<div class="msg"><div class="bub spin">Researching the web<span class="dots"><i></i><i></i><i></i></span></div></div>`;
  if (!r.memories.length) return `<div class="msg"><div class="bub abst"><p>Nothing useful found for <b>${esc(r.query)}</b>.</p></div></div>`;
  const priv = !r.memories[0].visibleTo.includes("workspace");
  return `<div class="msg"><div class="bub rsch"><p><span class="badge web">web</span> Remembered ${r.memories.length} new ${r.memories.length === 1 ? "memory" : "memories"} for <b>${esc(r.query)}</b>${priv ? ' <span class="k">(private to you)</span>' : ""}</p>
    <ul>${r.memories.map((x: any) => `<li>${esc(x.text.replace(/\s*Source: .*$/, ""))} ${x.sources.map((s: any) => `<a class="src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.url)}">${esc(s.title.slice(0, 40))}</a>`).join(" · ")}</li>`).join("")}</ul>
    <p class="k">Tavily search · ${r.credits} credit · ${esc(r.model ?? "no model: title + snippet")}</p></div></div>`;
}
async function research(query: string, entityId?: string) {
  if (!query.trim() || S.busy) return;
  S.busy = true;
  const slot: any = { role: "bot", research: { query, pending: true, memories: [] } };
  S.chat.push({ role: "user", q: `Research: ${query}` }, slot);
  if (S.tab !== "chat") go("chat"); else void render();
  try {
    const r = await api("/api/research", { query, ...(entityId ? { entityId } : {}) });
    slot.research = r; for (const x of r.memories) S.texts.set(x.id, x.text);
    S.lastUsed = r.memories.map((x: any) => x.id); S.graph = null; // the map reloads with the new memories
  } catch (e) { delete slot.research; slot.error = (e as Error).message; }
  S.busy = false; if (S.tab === "chat") void render();
}
function viewChat() {
  if (!S.chat.length) return `<div class="empty"><h1>Ask your <b>memory</b></h1><p>Answers cite the memories they come from.</p>
    <div class="chips">${((S.cfg?.samples ?? []) as string[]).map((q) => `<button class="btn" data-act="ask" data-q="${esc(q)}">${esc(q)}</button>`).join("")}</div></div>`;
  return S.chat.map((m, i) => chatItem(m, i)).join("");
}

// ---------- memory ----------
const TYPE_COL: Record<string, string> = { memory: "#9fd6ff", superseded: "#6b7079", insight: "#c7a6ff", security: "#ff6b57", "security-flag": "#ff6b57", "agent-run": "#ffd166", entity: "#4c9aff", web: "#ff9f43" };
const LEGEND = ["memory", "superseded", "insight", "security", "agent-run", "web", "entity"];
function memHead() {
  return `<div class="maphead"><div class="seg">${(["map", "list", "changed", "privacy"] as MemView[]).map((v) => `<button data-act="mem" data-v="${v}" class="${S.mem === v ? "on" : ""}">${v[0]!.toUpperCase() + v.slice(1)}</button>`).join("")}</div>
    ${S.mem === "map" ? `<div class="seg sm">${(["graph", "time", "type", "cluster"] as Layout[]).map((l) => `<button data-act="layout" data-l="${l}" class="${S.layout === l ? "on" : ""}">${l}</button>`).join("")}</div>` : ""}
    <span id="count" class="count"></span></div>`;
}
const GRAPH_CAP = 1500, LIST_PAGE = 200;
function mapStatus(t: string) { const w = document.getElementById("mapwrap"); if (!w) return; let el = document.getElementById("mapstat"); if (!el) { el = document.createElement("div"); el.id = "mapstat"; el.className = "k mstat"; el.style.cssText = "position:absolute;left:12px;top:8px;z-index:3"; w.append(el); } el.textContent = t; if (!t) el.remove(); }
/** Graph over SSE (meta, then node/edge batches); falls back to the capped JSON graph. Never hangs: 60 s guard. */
function fetchGraph(): Promise<any> {
  const json = () => api(`/api/demo/graph?limit=${GRAPH_CAP}`);
  if (typeof EventSource === "undefined") return json();
  return new Promise((resolve) => {
    const g: any = { nodes: [], edges: [] }; let meta = false, total = 0, fin = false;
    const es = new EventSource(API_BASE + "/api/stream/graph", { withCredentials: !!API_BASE });
    const end = (fallback: boolean) => { if (fin) return; fin = true; es.close(); clearTimeout(guard); mapStatus(""); resolve(fallback ? json().catch(() => g) : g); };
    const guard = setTimeout(() => end(!g.nodes.length), 60000);
    es.addEventListener("meta", (ev: any) => { meta = true; try { const m = JSON.parse(ev.data); total = m.total ?? m.nodes ?? 0; for (const k of ["counts", "entities", "entityCounts"]) if (m[k] && typeof m[k] === "object") g[k] = m[k]; } catch {} mapStatus(`Loading map… 0 of ${total}`); });
    es.addEventListener("batch", (ev: any) => { try { const b = JSON.parse(ev.data); for (const x of b.items ?? []) { if (!x) continue; if (b.kind === "edge" || (b.kind !== "node" && x.from && x.to && !x.id)) g.edges.push(x); else g.nodes.push(x); } } catch {} mapStatus(`Loading map… ${g.nodes.length}${total ? ` of ${total}` : ""} nodes, ${g.edges.length} links`); });
    es.addEventListener("done", () => end(false));
    es.addEventListener("error", (ev: any) => { if (ev?.data) { end(!meta || !g.nodes.length); } });
    es.onerror = () => end(!meta || !g.nodes.length);
  });
}
async function loadGraph() {
  const g = await fetchGraph();
  g.nodes = (g.nodes ?? []).filter((x: any) => x && x.id); g.edges = g.edges ?? [];
  for (const x of g.nodes) { x.text = String(x.text ?? x.name ?? ""); x.createdAt = typeof x.createdAt === "string" ? x.createdAt : ""; x.type = x.type ?? "memory"; }
  { const ids = new Set(g.nodes.map((x: any) => x.id)); g.edges = g.edges.filter((e: any) => e && ids.has(e.from) && ids.has(e.to)); }
  S.graph = g;
  const ent = g.nodes.map(() => [] as string[]), idx = new Map<string, number>(g.nodes.map((x: any, i: number) => [x.id, i]));
  for (const e of g.edges) if (e.type === "same-entity" && e.label) { ent[idx.get(e.from)!]?.push(e.label); ent[idx.get(e.to)!]?.push(e.label); }
  S.hay = g.nodes.map((x: any, i: number) => `${x.text} ${x.type === "entity" ? `${(x.aliases ?? []).join(" ")} ${Object.values(x.fields ?? {}).map((f: any) => JSON.stringify(f?.value ?? "")).join(" ")}` : ""} ${x.type} ${x.kind ?? ""} ${x.severity ?? ""} ${x.createdAt.slice(0, 10)} ${ist(x.createdAt)} ${[...new Set(ent[i])].join(" ")}`.toLowerCase());
  for (const x of g.nodes) S.texts.set(x.id, x.text);
}
function listBody(x: any) {
  if (x.type === "entity") {
    const prof = linksOf(x.fields, esc);
    return `<span class="k">entity${x.kind ? ` · ${esc(x.kind)}` : ""}</span> <b>${esc(x.name)}</b>${(x.text ?? "").includes(": ") ? ` ${esc(x.text.slice(x.text.indexOf(": ") + 2))}` : ""} <span class="k">${x.memoryCount ?? 0} memories</span>${prof ? ` <span class="pl">${prof}</span>` : ""}`;
  }
  const s = x.type === "web" ? sourceOf(x.text) : null;
  return `<span class="k">${ist(x.createdAt)}</span> ${s ? `<span class="badge web" title="Public web data gathered by the demo seeder via Tavily: sources linked">web</span> ` : ""}${memHtml(x.text)}${s ? ` <a class="src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">source</a>` : ""}`;
}
async function viewMemory() {
  if (S.mem === "map") return memHead() + `<div class="mapwrap" id="mapwrap"><canvas id="mapc"></canvas><canvas id="mapo"></canvas><div class="hcard" id="hcard"></div><button class="mapreset" id="mapreset" title="Reset view (or double-click empty space)">Reset view</button>
      <div class="legend">${LEGEND.filter((t) => t !== "web" && t !== "entity" || S.graph?.nodes.some((x: any) => x.type === t)).map((t) => `<span><i style="background:${TYPE_COL[t]}"></i>${t}</span>`).join("")}</div></div>`;
  if (S.mem === "list") return memHead() + `<div class="list" id="mlist"></div><p id="mstat" class="k mstat"><span class="spin">Loading memories<span class="dots"><i></i><i></i><i></i></span></span></p>`;
  if (S.mem === "changed") {
    const r = await api("/api/demo/timeline");
    const ch = (r.changed ?? []).filter((i: any) => i.status === "replaced");
    return memHead() + `<div class="list">${ch.map((i: any, o: number) => `<div class="li chg" data-id="${i.id}" data-o="${o}" data-f="${esc(`${i.text} ${i.replacedByText} ${i.key ?? ""} ${String(i.createdAt ?? "").slice(0, 10)}`.toLowerCase())}"><span class="old"><span class="t">${esc(i.text)}</span></span><span class="arrow"> → </span><b>${esc(i.replacedByText)}</b></div>`).join("") || '<div class="k">No changed facts yet.</div>'}</div>`;
  }
  const p = S.privacy ?? (S.privacy = await api("/api/demo/privacy"));
  return memHead() + `<div class="list">${(p.items ?? []).slice(0, (S.q.memory ?? "").trim() ? Infinity : S.pvShown).map((m: any, o: number) => { m.sensitive = m.sensitive ?? []; return `<div class="li pv" id="pv-${m.id}" data-id="${m.id}" data-o="${o}" data-f="${esc(`${m.text} ${m.sensitive.join(" ")}`.toLowerCase())}"><span class="t">${memHtml(m.text)}</span>${m.sensitive.length ? ` <span class="chip warn">${esc(m.sensitive.join(", "))}</span>` : ""}
    <span class="acts">${m.sensitive.length ? `<button class="btn" data-act="redact" data-id="${m.id}">Redact</button>` : ""}<button class="btn" data-act="forget" data-id="${m.id}">Forget</button></span></div>`; }).join("") || '<div class="k">No memories.</div>'}</div>
    ${!(S.q.memory ?? "").trim() && (p.items ?? []).length > S.pvShown ? `<p><a href="#" class="dlink" data-act="pvmore" id="pvmore">Showing ${S.pvShown} of ${p.items.length} · load ${Math.min(LIST_PAGE, p.items.length - S.pvShown)} more</a></p>` : ""}`;
}

// ---------- memory list: streamed in batches (SSE, JSON paging fallback); search always runs on the server over the whole store ----------
const LS = { seq: 0, es: null as EventSource | null, n: 0, total: null as number | null, timer: 0 as any };
function stopList() { LS.seq++; LS.es?.close(); LS.es = null; clearTimeout(LS.timer); }
const memRow = (x: any) => {
  const type = x.type ?? ((x.tags ?? []).includes("web") || sourceOf(String(x.text ?? "")) ? "web" : "memory");
  const t = String(x.text ?? x.name ?? ""); const clip = t;
  return `<div class="li" data-id="${esc(x.id)}"><i style="background:${TYPE_COL[type] ?? "#999"}"></i>${listBody({ ...x, type, text: clip, createdAt: String(x.createdAt ?? "") })}</div>`;
};
/** Append items in rAF-sized chunks so the main thread never blocks. */
function appendRows(my: number, xs: any[]) {
  const host = document.getElementById("mlist"); if (!host) return;
  let i = 0;
  const step = () => { if (my !== LS.seq) return; host.insertAdjacentHTML("beforeend", xs.slice(i, i + 50).map(memRow).join("")); i += 50; if (i < xs.length) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function listStat(html: string, busy = false) {
  const el = document.getElementById("mstat"); if (el) el.innerHTML = busy ? `<span class="spin">${html}<span class="dots"><i></i><i></i><i></i></span></span>` : html;
  const c = document.getElementById("count"); if (c) c.innerHTML = `${LS.n}${LS.total != null ? ` of ${LS.total}` : ""} memories`;
}
async function startList() {
  stopList(); const my = LS.seq; LS.n = 0; LS.total = null;
  const host = document.getElementById("mlist"); if (!host) return; host.innerHTML = "";
  const q = (S.q.memory ?? "").trim();
  const got = (xs: any[]) => { if (my !== LS.seq) return; for (const x of xs) if (x?.id) S.texts.set(x.id, x.text); LS.n += xs.length; appendRows(my, xs); };
  if (q) { // server-side search over the whole (access-filtered) store; never a filter over the loaded batch
    listStat(`Searching all memories for “${esc(q)}”`, true);
    try {
      const r = await api(`/api/memories?q=${encodeURIComponent(q)}&limit=200`); if (my !== LS.seq) return;
      const xs = r.items ?? []; LS.total = r.total ?? null; got(xs);
      listStat(xs.length ? `${xs.length}${r.total != null ? ` of ${r.total}` : ""} matches from the whole store (server search)` : `No memories match “${esc(q)}”.`);
    } catch (e) { if (my === LS.seq) listStat(errBox("search results", e)); }
    return;
  }
  const json = async () => { // fallback: JSON pages of 100, fetched in the background
    let cursor: any = null, offset = 0;
    try {
      for (;;) {
        const r = await api(`/api/memories?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : `&offset=${offset}`}`); if (my !== LS.seq) return;
        const xs = r.items ?? []; if (r.total != null) LS.total = r.total; got(xs); offset += xs.length;
        cursor = r.nextCursor ?? r.cursor ?? null; const more = xs.length > 0 && (r.nextOffset != null || cursor);
        listStat(more ? `Loaded ${LS.n}${LS.total != null ? ` of ${LS.total}` : ""}` : `Loaded ${LS.n}${LS.total != null ? ` of ${LS.total}` : ""} memories.`, !!more);
        if (!more) return;
        if (r.nextOffset != null) offset = r.nextOffset;
        await new Promise((res) => setTimeout(res, 30));
      }
    } catch (e) { if (my === LS.seq) listStat(`Loaded ${LS.n}. ${errBox("more memories", e)}`); }
  };
  listStat("Loading memories", true);
  if (typeof EventSource === "undefined") return void json();
  let meta = false;
  const es = (LS.es = new EventSource(API_BASE + "/api/stream/memories", { withCredentials: !!API_BASE }));
  es.addEventListener("meta", (ev: any) => { meta = true; try { LS.total = JSON.parse(ev.data).total ?? null; } catch {} listStat(`Loaded 0 of ${LS.total ?? "?"}`, true); });
  es.addEventListener("batch", (ev: any) => { meta = true; try { got(JSON.parse(ev.data).items ?? []); } catch {} listStat(`Loaded ${LS.n}${LS.total != null ? ` of ${LS.total}` : ""}`, true); });
  es.addEventListener("done", () => { es.close(); if (LS.es === es) LS.es = null; listStat(`Loaded ${LS.n}${LS.total != null ? ` of ${LS.total}` : ""} memories.`); });
  es.onerror = (ev: any) => {
    es.close(); if (LS.es === es) LS.es = null; if (my !== LS.seq) return;
    let msg = ""; try { msg = JSON.parse(ev.data ?? "").message ?? ""; } catch {}
    if (!meta) void json(); // stream not available (404 / old server): JSON paging
    else listStat(`Loaded ${LS.n}${LS.total != null ? ` of ${LS.total}` : ""}. <span class="k">Stream stopped${msg ? `: ${esc(msg)}` : ""}.</span> <a href="#" class="dlink" data-act="retry">Retry</a>`);
  };
}

// ---------- insights ----------
const KIND: Record<string, string> = { habit: "Habit", usage: "Usage", workflow: "Workflow", failure: "Failure lesson", security: "Security" };
const SEV: Record<string, number> = { high: 3, medium: 2, low: 1 };
const strength = (i: any) => (SEV[i.severity] ?? 0) * 2 + num(i.confidence) + Math.log10(1 + (i.evidence ?? []).length) * 0.3 - (i.status === "retired" ? 9 : 0);
function insightCard(i: any) {
  i.evidence = i.evidence ?? []; i.evidenceText = i.evidenceText ?? []; i.firstSeen = String(i.firstSeen ?? ""); i.lastSeen = String(i.lastSeen ?? ""); i.statement = i.statement ?? "";
  const badge = i.severity ? `<span class="sev ${i.severity}">${i.severity}</span>` : `<span class="conf">${Math.round(num(i.confidence) * 100)}%</span>`;
  return `<details class="ins ${i.status}" data-id="${i.memoryId ?? ""}" data-o="${S.insOrder.get(i) ?? 0}" data-f="${esc(`${i.statement} ${i.kind} ${i.severity ?? ""} ${i.status}`.toLowerCase())}" data-kind="${i.kind}" data-sev="${i.severity ?? ""}" data-status="${i.status}">
    <summary><span class="kind">${KIND[i.kind] ?? i.kind}</span>${badge}<span class="st">${esc(i.statement)}</span></summary>
    <div class="ev"><div class="k">${i.evidence.length} memories · confidence ${i.confidence} · ${i.status} · ${i.firstSeen.slice(0, 10)} to ${i.lastSeen.slice(0, 10)}</div>
    <ul>${i.evidenceText.map((e: any) => `<li>${memHtml(e.text)}</li>`).join("")}</ul></div></details>`;
}
async function viewInsights() {
  const r = (S.insights = await api("/api/demo/insights"));
  const xs = [...(r?.insights ?? [])].sort((a: any, b: any) => strength(b) - strength(a)); S.insOrder = new Map(xs.map((x, k) => [x, k]));
  const filtering = !!(S.q.insights ?? "").trim(), all = S.showAll || filtering;
  return `<div class="maphead"><button class="btn dark sm" data-act="reflect" ${S.reflecting ? "disabled" : ""}>${S.reflecting ? "Reflecting..." : "Reflect now"}</button><span class="k">Derived from raw memories; every insight cites its evidence.</span><span id="count" class="count"></span></div>
    <div class="list">${xs.map((i, k) => (k < 6 || all ? insightCard(i) : insightCard(i).replace("<details ", '<details data-more="1" hidden '))).join("")}</div>
    ${xs.length ? "" : `<p class="k">No insights yet. ${r?.skipped ? esc(r.skipped) : "Insights are derived by Reflect; on very large stores they may be skipped."}</p>`}
    ${xs.length > 6 && !all ? `<p><a href="#" class="dlink" data-act="all">Show all ${xs.length}</a></p>` : ""}
    <details class="sub"><summary>Learning from use <span class="k">(experimental)</span></summary><div id="learn">loading…</div></details>`;
}
async function loadLearning() {
  const el = document.getElementById("learn"); if (!el) return;
  try {
  if (!S.cfg?.learning) { el.innerHTML = '<p class="k">Learning is off in this config.</p>'; return; }
  const r = await api("/api/demo/learning");
  el.innerHTML = `<table><tr><th>memory</th><th>helpfulness</th><th>used</th><th>co-use links</th></tr>${(r.items ?? []).map((x: any) => `<tr><td>${esc(memLine(x.text, 160))}${chipHtml(x.text)}</td><td class="n">${x.helpMean ?? "–"}</td><td class="n">${x.used ?? 0}</td><td class="n">${(x.links ?? []).length}</td></tr>`).join("") || '<tr><td colspan=4 class="k">No usage yet.</td></tr>'}</table>`;
  } catch (e) { el.innerHTML = errBox("learning", e); }
}

// ---------- inspector (slide-out) ----------
const pct = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!; };
function latRow(name: string, xs: number[]) {
  const f = (v: number | null) => (v == null ? "–" : `${Math.round(v)} ms`);
  return `<tr><td>${name}</td><td class="n">${f(pct(xs, 50))}</td><td class="n">${f(pct(xs, 95))}</td><td class="n">${f(pct(xs, 99))}</td></tr>`;
}
function semSection() {
  const by = (p: string) => SEM.lat.filter((x) => x.path === p);
  const row = (l: string, xs: number[]) => `<tr><td>${l}</td><td class="n">${xs.length}</td><td class="n">${xs.length ? pct(xs, 50)!.toFixed(1) : "–"}</td><td class="n">${xs.length ? pct(xs, 95)!.toFixed(1) : "–"}</td></tr>`;
  return `<div class="kv"><span>path <b>server (VM)</b></span><span>model <b>nomic-embed-text-v1.5</b> 256-d, kept warm</span></div>
    <table><tr><th>ms</th><th>n</th><th>p50</th><th>p95</th></tr>${row("query embed on server", by("server").map((x) => x.embedMs))}${row("round trip", by("server").map((x) => x.ms))}${row("cached", by("cache").map((x) => x.ms))}</table>
    <p class="k">Hits: within ${SEM_BAND} of the top score and ${SEM_Z}σ above the mean, up to ${SEM_MAX}. Chat recall stays on Nebius Qwen3-Embedding-8B.</p>`;
}
function seedLine() {
  const s = S.seed; if (!s?.available) return "";
  const usd = (x: number) => `$${(x ?? 0).toFixed(4)}`;
  return `<section><h3>How this was built</h3><p class="k">Public web data gathered by the demo seeder via Tavily: sources linked.</p>
    <p>Tavily search (${s.tavily?.searchCalls ?? 0} calls, ${s.tavily?.credits ?? 0} credits) &rarr; ${s.enrichment?.model ? `${esc(s.enrichment.model)} enrichment on Nebius Token Factory (${s.enrichment.accepted} summaries kept, ${s.enrichment.rejectedAsUnfaithful} rejected as unfaithful, ${usd(s.enrichment.usd)})` : "no model enrichment"} &rarr; ${esc(s.embeddings?.model)} embeddings (${s.embeddings?.memories ?? 0} memories, ${s.embeddings?.entities ?? 0} entities, ${usd(s.embeddings?.usd)}) &rarr; ${s.memories} memories, ${Object.values(s.entities ?? {}).reduce((a: number, b: any) => a + b, 0)} entities.${s.mock ? " <b>(mock run)</b>" : ""}</p>
    <p class="k">The instant search box uses a small local nomic model on the server; answers and the stored vectors use Nebius.</p></section>`;
}
function entSection() {
  const g = S.graph; if (!g?.entityCounts) return `<p class="k">Open Memory to load entities.</p>`;
  const c = g.entityCounts as Record<string, number>, tot = Object.values(c).reduce((a, b) => a + num(b), 0);
  return `<div class="kv"><span>total <b>${tot}</b></span>${Object.entries(c).map(([k, v]) => `<span>${esc(k)} <b>${v}</b></span>`).join("")}</div>
    <table><tr><th>top entities</th><th>type</th><th class="n">memories</th></tr>${(g.entities ?? []).slice(0, 10).map((e: any) => `<tr><td>${esc(e.e)}</td><td>${esc(e.type ?? "")}</td><td class="n">${e.n}</td></tr>`).join("")}</table>
    <p class="k">Extracted on ingest (deterministic, no model call) and linked to memories; entity matches boost their memories in recall.</p>`;
}
async function renderInspector() {
  const d = $("#drawer"); if (!d.classList.contains("on")) return;
  try { await renderInspectorInner(d); } catch (e) { console.error(e); d.innerHTML = `<div class="dh"><b>Inspector</b><button class="btn sm" data-act="close">Close</button></div>${errBox("details", e)}`; }
}
async function renderInspectorInner(d: HTMLElement) {
  const answers = S.chat.filter((m) => m.r && !m.r.refused).map((m) => m.r);
  const sel = S.chat[S.sel]?.r ?? answers[answers.length - 1];
  const [c, nm, ins] = await Promise.all([api("/api/demo/config"), api("/api/demo/numbers").catch(() => ({ available: false })), sel?.q ? (Promise.race([api(`/api/demo/inspect?q=${encodeURIComponent(sel.q)}`), new Promise((res) => setTimeout(() => res(null), 12000))]).catch(() => null) as Promise<any>) : null, api("/api/demo/seed-info").then((x) => { S.seed = x; }).catch(() => null)]);
  if (S.cfg) S.cfg.wallet = c.wallet; renderWallet(c.wallet);
  const w = c.wallet ?? { balanceUsd: 0, spentUsd: 0, answers: 0, ledger: [] }, led = [...(w.ledger ?? [])].reverse().slice(0, 25);
  const fm = S.filterMs;
  const ansSec = !sel ? `<p class="k">Ask something in Chat to inspect its recall.</p>` : `
    <div class="qline">${esc(sel.q)}</div>
    <div class="kv"><span>embed <b>${sel.embedMs ?? "–"} ms</b></span><span>recall <b>${sel.recallMs ?? "–"} ms</b></span><span>reader <b>${sel.readerMs ?? sel.answerMs ?? "–"} ms</b></span><span>total <b>${num(sel.embedMs) + num(sel.recallMs) + num(sel.answerMs)} ms</b></span></div>
    ${sel.tokens || sel.cost ? `<div class="kv"><span>tokens <b>${num(sel.tokens?.sent).toLocaleString()}</b> vs ${num(sel.tokens?.fullHistory).toLocaleString()} full</span><span>cost <b>${usd(sel.cost?.usd)}</b> vs ${usd(sel.cost?.fullUsd)}</span></div>` : ""}
    ${sel.abstained ? `<p class="k">Abstained: evidence ${num(sel.evidence).toFixed(2)} below threshold ${sel.threshold}.${sel.reason ? " " + esc(sel.reason) : ""}</p>` : ""}
    ${(sel.cited ?? []).length ? `<h4>Memories used</h4><ol>${sel.cited.map((x: any) => { const s = sourceOf(x.text); return `<li>${s ? `<span class="badge web">web</span> ` : ""}${memHtml(x.text)}${s ? ` <a class="src" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc((() => { try { return new URL(s.url).hostname; } catch { return "source"; } })())}</a>` : ""}</li>`; }).join("")}</ol>` : ""}
    ${(sel.derived ?? []).map((x: any) => `<h4>${KIND[x.kind] ?? x.kind} insight, from ${(x.evidence ?? []).length} memories</h4><ul>${(x.evidence ?? []).map((e: any) => `<li>${memHtml(e.text)}</li>`).join("")}</ul>`).join("")}
    ${ins ? `<h4>Ranking sent to the reader</h4><table><tr><th>#</th><th>memory</th><th>score</th></tr>${(ins.final ?? []).slice(0, 8).map((x: any) => `<tr class="${x.kept ? "" : "cut"}"><td class="n">${x.rank}</td><td>${esc(memLine(x.text, 110))}${chipHtml(x.text)}</td><td class="n">${x.score?.toFixed?.(3) ?? "-"}</td></tr>`).join("")}</table>
      <p class="k">BM25 ${(ins.keyword ?? []).length} hits · vector ${(ins.vector ?? []).length} hits · fused with ${esc(ins.fusion)} (k=${ins.rrfK}) · evidence ${ins.evidence}</p>` : ""}`;
  const evalSec = !nm?.available ? `<p class="k">No eval report found.</p>` : `
    <div class="kv"><span>accuracy <b>${(num(nm.accuracy) * 100).toFixed(1)}%</b> (${nm.scored}/${nm.total})</span><span>abstention <b>${nm.abstention?.absCorrect ?? "–"}/${nm.abstention?.absQuestions ?? "–"}</b></span></div>
    <div class="kv"><span>tokens/question <b>${num(nm.tokens?.meanIn).toLocaleString()}</b> vs ${num(nm.tokens?.meanFull).toLocaleString()}</span><span>cost/question <b>${usd(nm.cost?.perQuestionUsd)}</b></span></div>
    <p class="note">${esc(nm.note)}</p><p class="k">LongMemEval-S · reader ${esc(nm.reader)} · judge ${esc(nm.judge)} · updated ${ist(nm.updatedAt)} IST</p>`;
  d.innerHTML = `<div class="dh"><b>Inspector</b><button class="btn sm" data-act="close">Close</button></div>
    <section><h3>${S.sel >= 0 ? "Selected answer" : "Last answer"}</h3>${ansSec}</section>
    <section><h3>Live latency <span class="k">(this session, ${answers.length} answers)</span></h3>
      <table><tr><th></th><th>p50</th><th>p95</th><th>p99</th></tr>${latRow("embedding", answers.map((a) => a.embedMs).filter((x) => x != null))}${latRow("recall", answers.map((a) => a.recallMs).filter((x) => typeof x === "number"))}${latRow("reader", answers.map((a) => a.readerMs ?? a.answerMs).filter((x) => typeof x === "number"))}</table>
      ${answers.length ? `<p class="k">Per answer: ${usd(answers.reduce((a, x) => a + num(x.cost?.usd), 0) / answers.length)} and ${Math.round(answers.reduce((a, x) => a + num(x.tokens?.sent), 0) / answers.length).toLocaleString()} tokens on average. ${answers.length < 20 ? "p99 needs more answers to mean much." : ""}</p>` : ""}
      ${fm.length ? `<p class="k">Filter: ${fm.length} keystrokes, p50 ${pct(fm, 50)!.toFixed(2)} ms, p99 ${pct(fm, 99)!.toFixed(2)} ms, max ${Math.max(...fm).toFixed(2)} ms.</p>` : ""}</section>
    <section><h3>Semantic search <span class="k">(Memory and Insights filters)</span></h3>${semSection()}</section>
    ${seedLine()}
    <section><h3>Entities</h3>${entSection()}</section>
    <section><h3>Demo credits</h3><div class="kv"><span>balance <b>$${num(w.balanceUsd).toFixed(4)}</b></span><span>spent ${usd(w.spentUsd)}</span><span>${w.answers ?? 0} answers</span></div>
      <p><button class="btn dark sm" data-act="topup">Top up $5 (demo)</button> <button class="btn sm" data-act="drain">Set to $0.001</button></p>
      <table><tr><th>when (IST)</th><th>what</th><th>amount</th></tr>${led.map((e: any) => `<tr><td class="n">${ist(e.at)}</td><td><b>${esc(e.kind)}</b> <span class="k">${esc(e.note)}</span></td><td class="n">${num(e.usd) >= 0 ? "+" : "−"}${usd(Math.abs(num(e.usd)))}</td></tr>`).join("") || '<tr><td colspan=3 class="k">No charges yet.</td></tr>'}</table>
      <p class="k">Not real money. Each answer and reflect run deducts its real Nebius cost at the configured prices.</p></section>
    <section><h3>Eval</h3>${evalSec}</section>`;
}
function openInspector(i = -1) { S.sel = i; $("#drawer").classList.add("on"); $("#drawer").innerHTML = '<p class="k">Loading…</p>'; void renderInspector(); }

// ---------- render ----------
async function render() {
  const el = $("#content"), t = S.tab, mv = S.mem;
  if (t !== "chat" && !el.querySelector(".list,#mapwrap")) el.innerHTML = `<div class="list">${'<div class="li" style="opacity:.35">&nbsp;</div>'.repeat(6)}</div><p class="k mstat">Loading…</p>`;
  try {
    const html = t === "chat" ? viewChat() : t === "memory" ? await viewMemory() : await viewInsights();
    if (S.tab !== t || S.mem !== mv) return;
    if (!(t === "memory" && mv === "map")) { S.map?.destroy(); S.map = null; }
    el.innerHTML = html;
    el.classList.toggle("full", t === "memory" && mv === "map");
    if (t === "chat") el.scrollTop = el.scrollHeight;
    if (t === "memory" && mv === "map") {
      S.map?.destroy(); S.map = null;
      if (!S.graph) await loadGraph();
      S.map = await mountMap($("#mapwrap"), S.graph, S.layout); S.map.pulse(S.lastUsed);
    }
    if (t === "memory" && mv === "list") void startList(); else stopList();
    if (t === "insights") void loadLearning();
    if (t !== "chat" && !(t === "memory" && mv === "list")) { S.maskSig = "~"; applyFilter(); semSchedule(); }
  } catch (e) { console.error(e); if (S.tab === t) el.innerHTML = errBox(t === "memory" ? `memory (${mv})` : t, e); }
}

async function ask(q: string) {
  if (S.busy || !q.trim()) return;
  S.busy = true; S.q.chat = ""; ($("#q") as HTMLInputElement).value = "";
  const btn = $<HTMLButtonElement>(".send"); btn.disabled = true;
  S.chat.push({ role: "user", q }, { role: "bot", pending: true });
  if (S.tab !== "chat") go("chat"); else void render();
  const slot = S.chat[S.chat.length - 1];
  try {
    const slow = setTimeout(() => { if (slot.pending) { slot.slow = true; if (S.tab === "chat") void render(); } }, 2500);
    try { slot.r = await api("/api/demo/ask", { q, session: S.session }); } finally { clearTimeout(slow); }
    if (slot.r.research?.ran) S.graph = null; // new memories: the map reloads
    if (S.cfg) S.cfg.wallet = slot.r.wallet; renderWallet(slot.r.wallet);
    for (const m of slot.r.shown ?? []) S.texts.set(m.id, m.text);
    S.lastUsed = (slot.r.shown ?? []).map((m: any) => m.id);
  } catch (e) { slot.error = (e as Error).message; }
  slot.pending = false; S.busy = false; btn.disabled = false; S.sel = -1;
  if (S.tab === "chat") void render();
  void renderInspector();
}

function openMem(id: string) {
  const d = $("#drawer"); S.sel = -2;
  d.innerHTML = `<div class="dh"><b>Memory</b><button class="btn sm" data-act="close">Close</button></div><section><p>${esc(S.texts.get(id) ?? "")}</p><p class="id">${esc(id)}</p></section>`;
  d.classList.add("on");
}

document.addEventListener("click", async (ev) => {
  const t = ev.target as HTMLElement;
  const tab = t.closest<HTMLElement>("[data-tab]"); if (tab) return go(tab.dataset.tab as Tab);
  const mem = t.closest<HTMLElement>("[data-mem]"); if (mem) { ev.preventDefault(); return openMem(mem.dataset.mem!); }
  const a = t.closest<HTMLElement>("[data-act]");
  if (!a) return;
  const act = a.dataset.act;
  if (a.tagName === "A") ev.preventDefault();
  if (act === "inspector") return $("#drawer").classList.contains("on") && S.sel !== -2 ? $("#drawer").classList.remove("on") : openInspector();
  if (act === "inspect") return openInspector(Number(a.dataset.i));
  if (act === "close") $("#drawer").classList.remove("on");
  if (act === "ask") void ask(a.dataset.q!);
  if (act === "rcredits") return void openCredits();
  if (act === "research") { (a as HTMLButtonElement).disabled = true; return void research(a.dataset.q!, a.dataset.e || undefined); }
  if (act === "askq") { const q = a.dataset.q!; go("chat"); void ask(q); }
  if (act === "mem") { S.showAll = false; S.mem = a.dataset.v as MemView; renderTabs(); void render(); }
  if (act === "layout") { S.layout = a.dataset.l as Layout; S.map?.setLayout(S.layout); document.querySelectorAll("[data-act=layout]").forEach((b) => b.classList.toggle("on", b === a)); }
  if (act === "all") { S.showAll = true; void render(); }
  if (act === "pvmore") { S.pvShown += LIST_PAGE; void render(); return; }
  if (act === "retry") { S.privacy = null; S.graph = null; void render(); void renderInspector(); }
  if (act === "reflect") {
    S.reflecting = true; void render();
    try { const r = await api("/api/demo/reflect", {}); if (r.wallet) { S.cfg.wallet = r.wallet; renderWallet(r.wallet); } S.graph = null; } catch (e) { alert((e as Error).message); }
    S.reflecting = false; void render(); void renderInspector();
  }
  if (act === "topup") { const w = await api("/api/demo/topup", { usd: 5 }); S.cfg.wallet = w; renderWallet(w); void renderInspector(); if (S.tab === "chat") void render(); }
  if (act === "drain") { const w = await api("/api/demo/set-balance", { usd: 0.001 }); S.cfg.wallet = w; renderWallet(w); void renderInspector(); }
  if (act === "forget" || act === "redact") {
    if (act === "forget" && !confirm("Hard-delete this memory permanently?")) return;
    a.textContent = "..."; await api(`/api/demo/${act}`, { id: a.dataset.id }); S.graph = null; S.privacy = null; void render();
  }
});
document.addEventListener("input", (ev) => {
  const f = ev.target as HTMLInputElement;
  if (f.id !== "q") return;
  S.q[S.tab] = f.value;
  if (S.tab === "memory" && S.mem === "list") { clearTimeout(LS.timer); LS.timer = setTimeout(() => void startList(), 300); return; }
  if (S.tab !== "chat") { applyFilter(); semSchedule(); }
});
document.addEventListener("submit", (ev) => {
  ev.preventDefault();
  const f = ev.target as HTMLElement;
  if (f.id !== "composer") return;
  const v = ($("#q") as HTMLInputElement).value;
  if (S.tab === "chat") return void ask(v);
  // Enter on a filter tab: run the semantic half now, and offer to ask about it, subtly
  semSchedule(true);
  const c = document.getElementById("count");
  if (c && v.trim() && !c.querySelector("[data-act=askq]")) c.insertAdjacentHTML("beforeend", ` <a href="#" class="dlink" data-act="askq" data-q="${esc(v)}">Ask Clearmind about this →</a>`);
});

(async () => {
  await initTenancy(API_BASE);
  renderTabs();
  try {
    S.cfg = await api("/api/demo/config");
    $("#model").textContent = `${String(S.cfg?.reader ?? "").split("/").pop()} on Nebius`;
    renderWallet();
  } catch (e) { console.error(e); S.cfg = S.cfg ?? {}; }
  void render(); // never wait on the timeline: it only seeds citation tooltips
  api("/api/demo/timeline").then((t) => { for (const m of t?.items ?? []) S.texts.set(m.id, m.text); }).catch((e) => console.warn("timeline:", e));
})().catch((e) => { console.error(e); $("#content").innerHTML = errBox("the app", e); });
