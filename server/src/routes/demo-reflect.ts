// Demo routes for reflect (derived insights) and the memory graph (relations between memories).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ADMIN, WORKSPACE } from "@clearmind/core";
import type { Clearmind, Config, Viewer } from "@clearmind/core";
import { mineAll, reconcile, REFLECT_SYSTEM } from "../reflect.js";
import type { Candidate, Insight, MemRow } from "../reflect.js";
import type { Route, RouteContext } from "./types.js";
import { addLedger, ledgerSince, ledgerSize, MIN_BALANCE_USD, readWallet, saveWallet } from "./demo.js";
import { HttpError } from "../http.js";

type Chat = (m: { role: string; content: string }[], o?: { json?: boolean; maxTokens?: number }) => Promise<{ content: string; usd: number; promptTokens: number; completionTokens: number }>;
type Emb = (t: string[]) => Promise<ArrayLike<number>[]>;
const opts = (cm: Clearmind) => (cm as unknown as { opts: { chat?: Chat; embedder?: Emb } }).opts;
const insightFile = (cfg: Config, user: string) => join(cfg.dataDir, `insights.${user}.json`);
export function readInsights(cfg: Config, user: string): { insights: Insight[]; runs: { at: string; usd: number; ms: number; mined: number; llm: number }[] } {
  try { return JSON.parse(readFileSync(insightFile(cfg, user), "utf8")); } catch { return { insights: [], runs: [] }; }
}

interface DbRow { lesson_id: string; text: string; created_at: string; trigger: string | null; status: string; replaced_by: string | null; extra: string }
function allRows(cfg: Config, user: string): DbRow[] {
  const d = new DatabaseSync(join(cfg.dataDir, "memory.db"), { readOnly: true });
  try {
    return d.prepare(`SELECT lesson_id,text,created_at,trigger,status,replaced_by,extra FROM lessons WHERE namespace='clearmind' AND user_id=? AND agent_id='owner' AND status IN ('active','replaced') ORDER BY created_at`).all(user) as unknown as DbRow[];
  } finally { d.close(); }
}
/** Insights the viewer may see: evidence cut to visible memories; dropped when none is visible or its own memory is hidden. */
export function visibleInsights(ins: Insight[], vis: Set<string> | null): Insight[] {
  if (!vis) return ins;
  return ins.map((i) => ({ ...i, evidence: i.evidence.filter((e) => vis.has(e)) })).filter((i) => i.evidence.length && (!i.memoryId || vis.has(i.memoryId)));
}
/** An insight is visible only to principals who can see ALL its evidence: undefined = workspace; no common principal = admin only. */
export async function insightVisibility(cm: Clearmind, evidence: string[]): Promise<string[] | undefined> {
  let common = null as Set<string> | null; // null = everyone so far
  for (const id of evidence) {
    const to = await cm.visibleToOf(id);
    if (to.includes(WORKSPACE)) continue;
    common = common ? new Set([...common].filter((p: string) => to.includes(p))) : new Set(to);
  }
  return common === null ? undefined : common.size ? [...common] : [ADMIN];
}
const toMem = (r: DbRow): MemRow => ({ id: r.lesson_id, text: r.text, createdAt: r.created_at, tags: String(r.trigger ?? "").split(/\s+/).filter(Boolean) });

/** Ask the reader to word one mined cluster; it may only cite ids from that cluster. Falls back to the mined statement. */
async function word(chat: Chat | undefined, c: Candidate): Promise<{ statement: string; cite: string[]; usd: number; llm: boolean }> {
  if (!chat) return { statement: c.fallback, cite: c.evidence, usd: 0, llm: false };
  for (let attempt = 0; attempt < 2; attempt++) try {
    const r = await chat([{ role: "system", content: REFLECT_SYSTEM }, { role: "user", content: c.prompt }], { json: true, maxTokens: 900 });
    const j = JSON.parse(r.content.replace(/^```(?:json)?|```$/g, "").trim());
    const cite = (Array.isArray(j.cite) ? j.cite : []).map(String).filter((id: string) => c.evidence.includes(id));
    const st = String(j.statement ?? "").replace(/\s*\[[0-9A-Z]{10,}\]/g, "").trim();
    if (!st || !cite.length) continue; // no citation, no LLM wording
    return { statement: st, cite, usd: r.usd, llm: true };
  } catch { /* retry once, then fall back to the mined statement */ }
  return { statement: c.fallback, cite: c.evidence, usd: 0, llm: false };
}

async function pool<T, R>(xs: T[], n: number, f: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (i < xs.length) { const k = i++; out[k] = await f(xs[k]!); } }));
  return out;
}

const memText = (i: Insight) => `${i.status === "retired" ? "Retired insight (no longer holds)" : "Insight"} (${i.kind}${i.severity ? `, severity ${i.severity}` : ""}, confidence ${i.confidence}; derived by Clearmind reflect from ${i.evidence.length} memories, ${i.firstSeen.slice(0, 10)} to ${i.lastSeen.slice(0, 10)}): ${i.statement}`;

/** Run reflect: mine, word, reconcile, and store each insight as an 'insight' memory (key insight:<sig>). */
export async function reflect(cm: Clearmind, cfg: Config, user: string) {
  const t0 = performance.now();
  const off = ledgerSize(cfg);
  const rows = allRows(cfg, user).filter((r) => r.status === "active").map(toMem);
  const cands = mineAll(rows);
  const o = opts(cm);
  const worded = await pool(cands, 4, (c) => word(o.chat, c));
  const prev = readInsights(cfg, user);
  const now = new Date().toISOString();
  const fresh = cands.map((c, i) => ({ ...c, statement: worded[i]!.statement, evidence: c.evidence, stats: { ...c.stats, cited: worded[i]!.cite, wordedBy: worded[i]!.llm ? cfg.nebius.chatModel : "template" } }));
  const ins = reconcile(prev.insights, fresh, now).filter((i) => i.evidence.length > 0); // no insight without evidence
  // store as memories so answers can use and cite them; same key supersedes the previous wording
  const texts = ins.map(memText);
  const vecs = o.embedder ? await o.embedder(texts) : [];
  for (const [k, i] of ins.entries()) {
    const visibleTo = await insightVisibility(cm, i.evidence);
    const m = await cm.remember(texts[k]!, { tags: ["insight", i.kind, ...(i.severity ? [`severity-${i.severity}`] : [])], key: `insight:${i.sig}`, embedding: vecs[k] ? Float32Array.from(vecs[k]!) : undefined, ...(visibleTo ? { visibleTo } : {}) } as never);
    i.memoryId = (m as { id: string }).id;
  }
  // real cost of this run: every Nebius call it made (wording + insight embeddings), from the spend ledger
  const usd = ledgerSince(cfg, off).filter((e) => e.user === user).reduce((a, e) => a + (e.usd ?? 0), 0);
  const w = readWallet(cfg, user);
  w.balanceUsd = Math.max(0, w.balanceUsd - usd); w.spentUsd += usd;
  addLedger(w, "reflect", -usd, `reflect: ${cands.length} findings, ${worded.filter((x) => x.llm).length} worded by Nemotron`);
  saveWallet(cfg, user, w);
  const run = { at: now, usd, ms: Math.round(performance.now() - t0), mined: cands.length, llm: worded.filter((w) => w.llm).length };
  writeFileSync(insightFile(cfg, user), JSON.stringify({ insights: ins, runs: [...prev.runs, run] }, null, 1));
  return { insights: ins, run, wallet: w };
}

// ---------- relations graph ----------
/** Entities worth a hub on the map: linked to 1..40% of memories (the user themself is everywhere, so not a hub), researched ones always. */
async function entityHubs(cm: RouteContext["cm"], ids: Set<string>, n: number, viewer?: Viewer) {
  let list: ReturnType<RouteContext["cm"]["entities"]["list"]> = [];
  try { list = (await cm.entityList({ limit: 5000 }, viewer)).entities; } catch { return []; }
  const out = [];
  for (const e of list) {
    // one visibility pass for all hubs: entityList(viewer) already hid invisible entities; cut memories/fields to the visible ids here
    // (per-entity entityDetail(id, viewer) recomputes visibility each call and made the map take seconds for non-admin viewers)
    const full = cm.entities.detail(e.id); if (!full) continue;
    const okF = (f: { memoryIds: string[] }) => !viewer || !f.memoryIds.length || f.memoryIds.some((m) => ids.has(m));
    const d = { ...full, fields: Object.fromEntries(Object.entries(full.fields).filter(([, f]) => okF(f))), history: full.history.filter(okF) };
    const mem = d.memoryIds.filter((m) => ids.has(m));
    const researched = Object.keys(d.fields).length > 0;
    if (!mem.length || (!researched && (mem.length < 2 || mem.length > Math.max(25, n * 0.4)))) continue;
    const fields = Object.fromEntries(Object.entries(d.fields).map(([k, f]) => [k, { value: f.value, sources: f.sources, fetchedAt: f.fetchedAt }]));
    const summary = String(Object.values(d.fields).find((f) => typeof f.value === "string" && !/^https?:/.test(f.value))?.value ?? ""); // first text field, whatever it is called
    out.push({ memoryIds: mem, score: mem.length + (researched ? 100 : 0), node: { id: e.id, name: e.name, text: `${e.name}${summary ? `: ${summary}` : ""}`, type: "entity", kind: e.type, createdAt: e.createdAt, status: "active", tags: [], aliases: e.aliases, fields, history: d.history.length, memoryCount: mem.length, confidence: null, severity: null, insightStatus: null } });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 80);
}
const NOT_ENTITY = new Set("Maya Chat Clearmind Journal Meeting Agent Email Action Calendar Profile Team Food Trip Org Breakfast Lunch Woke Around Evening Saturday Sunday Monday Tuesday Wednesday Thursday Friday Sep Oct Nov Dec IST The From Your If Install Installed Stayed Went Decided Agreed Usability Contrast Screen Target Renamed Dark Figma Insight Retired Gym Promotion".split(" "));
export async function graph(cfg: Config, user: string, cm?: RouteContext["cm"], viewer?: Viewer) {
  const vis = cm ? await cm.visibleMemoryIds(viewer) : null;
  const rs = vis ? allRows(cfg, user).filter((r) => vis.has(r.lesson_id)) : allRows(cfg, user);
  const insights = visibleInsights(readInsights(cfg, user).insights, vis);
  const insByMem = new Map(insights.filter((i) => i.memoryId).map((i) => [i.memoryId!, i]));
  const secEvidence = new Set(insights.filter((i) => i.kind === "security" && i.status !== "retired").flatMap((i) => i.evidence));
  const nodes = rs.map((r) => {
    const tags = String(r.trigger ?? "").split(/\s+/);
    const ins = insByMem.get(r.lesson_id);
    const type = ins ? (ins.kind === "security" ? "security" : "insight") : r.status === "replaced" ? "superseded" : tags.includes("agent-run") ? "agent-run" : tags.includes("web") ? "web" : secEvidence.has(r.lesson_id) ? "security-flag" : "memory";
    return { id: r.lesson_id, text: r.text, type, createdAt: r.created_at, status: r.status, tags, confidence: ins?.confidence ?? null, kind: ins?.kind ?? null, severity: ins?.severity ?? null, insightStatus: ins?.status ?? null };
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges: { from: string; to: string; type: string; label?: string; w?: number }[] = [];
  for (const r of rs) if (r.replaced_by && ids.has(r.replaced_by)) edges.push({ from: r.replaced_by, to: r.lesson_id, type: "supersedes" });
  for (const i of insights) {
    if (!i.memoryId || !ids.has(i.memoryId)) continue;
    for (const e of i.evidence) if (ids.has(e)) edges.push({ from: i.memoryId, to: e, type: "evidence" });
    for (const rel of i.relations ?? []) if (ids.has(rel.from) && ids.has(rel.to)) edges.push({ from: rel.from, to: rel.to, type: rel.type });
  }
  for (const r of rs) {
    const links = (JSON.parse(r.extra || "{}").learn?.links ?? {}) as Record<string, number>;
    for (const [to, w] of Object.entries(links)) if (ids.has(to) && r.lesson_id < to) edges.push({ from: r.lesson_id, to, type: "co-used", w: Number(w.toFixed(3)) });
  }
  // entity hubs from the entity store: each entity is a bigger node linked to the memories that mention it
  const hubs = cm ? await entityHubs(cm, ids, rs.length, viewer) : [];
  if (hubs.length) {
    for (const h of hubs) {
      nodes.push(h.node as never);
      for (const m of h.memoryIds) edges.push({ from: h.node.id, to: m, type: "same-entity", label: h.node.name });
    }
    const hubIds = new Set(hubs.map((h) => h.node.id));
    for (const r of await cm!.entityRelations(viewer)) if (hubIds.has(r.from) && hubIds.has(r.to)) edges.push({ from: r.from, to: r.to, type: "relation", label: r.predicate });
    const counts: Record<string, number> = {}; for (const e of edges) counts[e.type] = (counts[e.type] ?? 0) + 1;
    return { nodes, edges, counts, entities: hubs.map((h) => ({ e: h.node.name, n: h.memoryIds.length, id: h.node.id, type: h.node.kind })).sort((a, b) => b.n - a.n).slice(0, 40), entityCounts: (await cm!.entityList({ limit: 1 }, viewer)).counts };
  }
  // fallback without an entity store: proper nouns or domains shared by 2..25 memories, chained in time
  const ent = new Map<string, string[]>();
  for (const r of rs) {
    if (insByMem.has(r.lesson_id)) continue;
    const found = new Set<string>();
    for (const m of r.text.matchAll(/(?<![.!?]\s)(?<!^)\b([A-Z][a-z]{2,}(?: [A-Z][a-z]{2,})?)\b|\b([a-z0-9-]+\.example)\b/g)) { const e = (m[1] ?? m[2])!; if (!NOT_ENTITY.has(e.split(" ")[0]!)) found.add(e); }
    for (const e of found) (ent.get(e) ?? ent.set(e, []).get(e)!).push(r.lesson_id);
  }
  for (const [e, xs] of ent) if (xs.length >= 2 && xs.length <= 25) for (let k = 1; k < xs.length; k++) edges.push({ from: xs[k - 1]!, to: xs[k]!, type: "same-entity", label: e });
  const counts: Record<string, number> = {}; for (const e of edges) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return { nodes, edges, counts, entities: [...ent].filter(([, x]) => x.length >= 2 && x.length <= 25).map(([e, x]) => ({ e, n: x.length })).sort((a, b) => b.n - a.n).slice(0, 40) };
}

export const reflectRoutes: Route[] = [
  { method: "POST", path: "/api/demo/reflect", handle: async ({ cm, cfg, user, useModel }: RouteContext) => {
    const w = readWallet(cfg, user);
    if (w.balanceUsd < MIN_BALANCE_USD) throw new HttpError(402, `Demo credit balance $${w.balanceUsd.toFixed(4)} is too low to run reflect. Top up demo credits first.`);
    useModel(); return reflect(cm, cfg, user);
  } },
  { method: "GET", path: "/api/demo/insights", handle: async ({ cfg, user, cm, viewer }: RouteContext) => {
    const vis = await cm.visibleMemoryIds(viewer);
    const r = readInsights(cfg, user); const text = new Map(allRows(cfg, user).filter((x) => !vis || vis.has(x.lesson_id)).map((x) => [x.lesson_id, x.text]));
    return { ...r, insights: visibleInsights(r.insights, vis).map((i) => ({ ...i, evidenceText: i.evidence.map((id) => ({ id, text: text.get(id) ?? "(deleted)" })) })) };
  } },
  { method: "GET", path: "/api/demo/graph", handle: ({ cfg, user, cm, viewer }: RouteContext) => graph(cfg, user, cm, viewer) },
];
export const hasInsights = (cfg: Config, user: string) => existsSync(insightFile(cfg, user));
