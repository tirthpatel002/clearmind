// Demo routes for the hackathon UI: chat with cost/credits, recall inspector, timeline, learning, privacy, numbers.
// Everything here reads the same per-user store the app uses; nothing is mocked except the demo wallet.
import { lowConfidence, researchSummary } from "../research.js";
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { actrActivation, betaHelp, learningConfig } from "agentmemory";
import type { Lesson } from "agentmemory";
import { cosineSim, RETRIEVAL_DEFAULTS } from "@clearmind/core";
import type { Clearmind, Config } from "@clearmind/core";
import { HttpError } from "../http.js";
import { redactText } from "../redact.js";
import type { Route, RouteContext } from "./types.js";
import { readInsights } from "./demo-reflect.js";

/** Sample questions shown as buttons; their embeddings are pre-warmed at start. */
export const SAMPLE_QUESTIONS = [
  "Who are the judges?",
  "What are the judging criteria for this hackathon?",
  "How does Clearmind decide who can see a memory?",
  "How does recall rank and pick memories?",
  "Which Nebius models does Clearmind use, and for what?",
  "What happens when memory can't answer a question?",
  "How does Clearmind handle a fact that changed?",
];

/** Demo wallet: starting credit (USD), stored in <dataDir>/demo-wallet.json. Not real money. */
export const START_CREDIT_USD = 5;
/** Refuse an answer when the balance is below this (USD). */
export const MIN_BALANCE_USD = 0.005;
const K = 6;

export type LedgerEntry = { at: string; kind: "answer" | "reflect" | "topup" | "set"; usd: number; balanceUsd: number; note: string };
type Wallet = { balanceUsd: number; spentUsd: number; answers: number; sessions: Record<string, { usd: number; fullUsd: number; answers: number }>; ledger?: LedgerEntry[] };

const retr = (cfg: Config) => ({ ...RETRIEVAL_DEFAULTS, ...(cfg.retrieval ?? {}) });
const walletFile = (cfg: Config, user: string) => join(cfg.dataDir, `demo-wallet.${user}.json`);
export function readWallet(cfg: Config, user: string): Wallet {
  try { return JSON.parse(readFileSync(walletFile(cfg, user), "utf8")); } catch { return { balanceUsd: START_CREDIT_USD, spentUsd: 0, answers: 0, sessions: {} }; }
}
export const saveWallet = (cfg: Config, user: string, w: Wallet) => writeFileSync(walletFile(cfg, user), JSON.stringify(w, null, 1));
/** Append to the wallet's own ledger (newest last, capped). Signed usd: charges negative, top-ups positive. */
export function addLedger(w: Wallet, kind: LedgerEntry["kind"], usd: number, note: string) {
  (w.ledger ??= []).push({ at: new Date().toISOString(), kind, usd, balanceUsd: w.balanceUsd, note: note.slice(0, 120) });
  if (w.ledger.length > 300) w.ledger.splice(0, w.ledger.length - 300);
}

const auditFile = (cfg: Config) => join(cfg.dataDir, "demo-audit.jsonl");
function audit(cfg: Config, user: string, op: string, ids: string[], detail: Record<string, unknown> = {}) {
  appendFileSync(auditFile(cfg), JSON.stringify({ at: new Date().toISOString(), user, op, ids, ...detail }) + "\n");
}

function db(cfg: Config): DatabaseSync {
  const d = new DatabaseSync(join(cfg.dataDir, "memory.db"), { readOnly: true });
  d.exec("PRAGMA busy_timeout=3000");
  return d;
}
type Row = { lesson_id: string; text: string; status: string; replaced_by: string | null; created_at: string; updated_at: string; helped: number; hurt: number; extra: string; embedding: Uint8Array | null };
function rows(cfg: Config, user: string, active = true): Row[] {
  const d = db(cfg);
  try {
    return d.prepare(`SELECT lesson_id,text,status,replaced_by,created_at,updated_at,helped,hurt,extra,embedding FROM lessons
      WHERE namespace='clearmind' AND user_id=? AND agent_id='owner' ${active ? "AND status='active'" : "AND status IN ('active','replaced')"} ORDER BY created_at`).all(user) as Row[];
  } finally { d.close(); }
}
/** rows() limited to what the request's viewer may see (visible ids come from the indexed acl). */
async function vrows(ctx: RouteContext, active = true): Promise<Row[]> {
  const r = rows(ctx.cfg, ctx.user, active), s = await ctx.cm.visibleMemoryIds(ctx.viewer);
  return s ? r.filter((x) => s.has(x.lesson_id)) : r;
}
const vec = (b: Uint8Array) => new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));

/** Approximate tokens (chars/4), used only for the "full history" comparison. */
export const approxTokens = (s: string) => Math.ceil(s.length / 4);

const terms = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length > 2);
/** BM25 over the user's active memories (the keyword channel). */
export function bm25(query: string, docs: { id: string; text: string }[], k1 = 1.2, b = 0.75) {
  const q = [...new Set(terms(query))];
  const toks = docs.map((d) => terms(d.text));
  const avg = toks.reduce((a, t) => a + t.length, 0) / Math.max(1, toks.length);
  const df = new Map<string, number>();
  for (const t of toks) for (const w of new Set(t)) df.set(w, (df.get(w) ?? 0) + 1);
  return docs.map((d, i) => {
    let s = 0;
    const tf = new Map<string, number>(); for (const w of toks[i]!) tf.set(w, (tf.get(w) ?? 0) + 1);
    for (const w of q) {
      const f = tf.get(w); if (!f) continue;
      const n = df.get(w) ?? 0, idf = Math.log(1 + (docs.length - n + 0.5) / (n + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * toks[i]!.length) / avg));
    }
    return { id: d.id, score: s };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
}
/** Reciprocal rank fusion of ranked id lists. */
export function rrf(lists: { id: string }[][], k = 60) {
  const s = new Map<string, number>();
  for (const l of lists) l.forEach((x, i) => s.set(x.id, (s.get(x.id) ?? 0) + 1 / (k + i + 1)));
  return [...s].map(([id, score]) => ({ id, score })).sort((a, b) => b.score - a.score);
}

function learnRow(r: Row, cfg: Config, now = Date.now()) {
  const lc = learningConfig(retr(cfg).learningOptions);
  const x = JSON.parse(r.extra || "{}");
  const l = { helped: r.helped, hurt: r.hurt, extra: x } as unknown as Lesson;
  const st = x.learn ?? {};
  const acc: string[] = st.acc ?? [];
  const s = Number(st.s ?? 0) + r.helped, f = Number(st.f ?? 0) + r.hurt;
  return {
    id: r.lesson_id, text: r.text, helpMean: Number(betaHelp(l, lc).toFixed(3)), used: s, notUsed: f, count: s + f,
    activation: acc.length ? Number(actrActivation(acc.map((a) => Date.parse(a)), now, lc).toFixed(3)) : null,
    accesses: acc.length, links: Object.entries((st.links ?? {}) as Record<string, number>).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, w]) => ({ id, w: Number(w.toFixed(3)) })),
  };
}

export function ledgerSince(cfg: Config, offset: number) {
  const p = join(cfg.dataDir, "spend.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").slice(offset).split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
export const ledgerSize = (cfg: Config) => { const p = join(cfg.dataDir, "spend.jsonl"); return existsSync(p) ? statSync(p).size : 0; };
const price = (cfg: Config, m: string) => cfg.nebius.prices[m] ?? { in: 1, out: 3 };

async function ask(ctx: RouteContext) {
  const { cm, cfg, user, body, useModel, viewer } = ctx;
  const b = await body(10_000);
  const q = String(b.q ?? "").trim(), session = String(b.session ?? "default").slice(0, 64);
  if (!q) throw new HttpError(400, "question required");
  const w = readWallet(cfg, user);
  if (w.balanceUsd < MIN_BALANCE_USD) {
    return { refused: true, reason: `Your demo credit balance ($${w.balanceUsd.toFixed(4)}) is below the $${MIN_BALANCE_USD.toFixed(3)} needed for one answer. Top up demo credits to continue.`, wallet: w };
  }
  // chat edit: "Update: ...", "Correction: ...", "Actually, ..." rewrites the closest memory the user can see.
  // The old text is kept as a replaced version, so it shows under Memory > Changes.
  const edit = /^\s*(?:update|correction|correct|edit|change|actually)\b\s*[:,\-]?\s*([\s\S]+)$/i.exec(q);
  if (edit && edit[1]!.trim().length >= 12) {
    const newText = edit[1]!.trim();
    useModel();
    const te0 = performance.now();
    const ev0 = await cm.recallWithEvidence(newText, 3, undefined, viewer);
    const target = ev0.memories[0];
    if (target) {
      const nu = await cm.update(target.id, newText, { viewer });
      audit(cfg, user, "chat-edit", [target.id, nu.id], {});
      const body0 = target.text.includes("\n") ? target.text.slice(target.text.indexOf("\n") + 1).trim() : target.text;
      const old = body0.length > 220 ? body0.slice(0, 220) + "…" : body0;
      const ms = Math.round(performance.now() - te0);
      return {
        q, answer: `Updated your memory. The old version is kept as history under Memory > Changes.\n\nBefore: ${old}\n\nNow: ${newText}`,
        abstained: false, lowConfidence: false, research: null, reason: null, derived: [], edited: { from: target.id, to: nu.id },
        cited: [{ id: nu.id, text: nu.text }], shown: [{ id: nu.id, text: nu.text, createdAt: nu.createdAt, score: null }],
        evidence: ev0.evidence, threshold: 0, embedMs: 0, recallMs: ms, answerMs: 0, readerMs: null,
        tokens: { sent: 0, completion: 0, fullHistory: 0, memories: 0 },
        cost: { usd: 0, fullUsd: 0, savedPct: null, lines: [], embedUsd: 0, readerUsd: 0 },
        session: w.sessions[session] ?? { usd: 0, fullUsd: 0, answers: 0 }, wallet: w, learning: null,
      };
    }
  }
  useModel();
  const off = ledgerSize(cfg);
  // embed the question first (memoised in the provider) so recall timing is search only
  const emb = (cm as unknown as { opts: { embedder?: (t: string[]) => Promise<unknown> } }).opts.embedder;
  const te = performance.now();
  if (emb) await emb([q]);
  const embedMs = Math.round(performance.now() - te);
  const t0 = performance.now();
  let ev = await cm.recallWithEvidence(q, K, undefined, viewer);
  const recallMs = Math.round(performance.now() - t0);
  const before = new Map((await vrows(ctx)).map((r) => [r.lesson_id, learnRow(r, cfg)]));
  const t1 = performance.now();
  let res = await cm.ask(q, { k: K, recalled: ev, viewer }); // single recall, reused
  // automatic research: abstained or low-confidence recall -> search the web, remember sourced facts, answer again
  const ab0 = cfg.recall.abstain, thr0 = ev.cosine === null ? ab0.minEvidenceLexical : ab0.minEvidence;
  const low = lowConfidence(ev, { minHits: cfg.research.minHits, minEvidence: cfg.research.minEvidence ?? thr0 });
  let research: ReturnType<typeof researchSummary> | null = null;
  if ((res.abstained || low) && ctx.research) {
    const o = await ctx.research.tryAuto(cm, user, viewer, q);
    research = researchSummary(o);
    if (!("skipped" in o) && o.full.length) {
      try {
        const ev2 = await cm.recallWithEvidence(q, K, undefined, viewer), ids = new Set(ev2.memories.map((m) => m.id));
        const merged = { ...ev2, abstained: false, memories: [...o.full.filter((m) => !ids.has(m.id)), ...ev2.memories].slice(0, K + o.full.length) };
        const res2 = await cm.ask(q, { k: K, recalled: merged, viewer });
        ev = merged; res = res2;
      } catch { /* keep the first answer */ }
    }
  }
  const answerMs = Math.round(performance.now() - t1);
  const readerMs = (res as { usage?: { ms?: number } }).usage?.ms ?? null;
  const calls = ledgerSince(cfg, off).filter((e) => e.user === user);
  const embed = calls.filter((c) => c.kind === "embed"), chat = calls.filter((c) => c.kind === "chat");
  const sum = (xs: any[], k: string) => xs.reduce((a, x) => a + (x[k] ?? 0), 0);
  const costUsd = sum(calls, "usd");
  const promptTokens = sum(chat, "promptTokens"), completionTokens = sum(chat, "completionTokens");
  const all = await vrows(ctx);
  const fullTokens = all.reduce((a, r) => a + approxTokens(`[${r.lesson_id}] ${r.text}\n`), 0) + approxTokens(q) + 200;
  const rp = price(cfg, cfg.nebius.chatModel);
  const fullUsd = (fullTokens * rp.in + completionTokens * rp.out) / 1e6;
  w.balanceUsd = Math.max(0, w.balanceUsd - costUsd); w.spentUsd += costUsd; w.answers++;
  const s = (w.sessions[session] ??= { usd: 0, fullUsd: 0, answers: 0 });
  s.usd += costUsd; s.fullUsd += fullUsd; s.answers++;
  addLedger(w, "answer", -costUsd, q);
  saveWallet(cfg, user, w);
  const a = retr(cfg), ab = cfg.recall.abstain;
  const threshold = ev.cosine === null ? ab.minEvidenceLexical : ab.minEvidence;
  let reason: string | null = null;
  if (res.abstained) reason = ev.abstained
    ? (ev.candidates.length ? `No supporting memory found: best evidence ${ev.evidence.toFixed(2)} is below the ${threshold} threshold, so nothing was sent as fact.` : "No supporting memory found: recall returned no candidates.")
    : "No supporting memory found: the reader judged none of the recalled memories relevant.";
  const after = new Map((await vrows(ctx)).map((r) => [r.lesson_id, learnRow(r, cfg)]));
  const shown = res.memories.map((m) => ({ id: m.id, text: m.text, createdAt: m.createdAt, score: m.score ?? null }));
  // cited insights: show what Clearmind derived them from
  const ins = new Map(readInsights(cfg, user).insights.filter((i) => i.memoryId).map((i) => [i.memoryId!, i]));
  const byId = new Map(all.map((r) => [r.lesson_id, r.text]));
  const derived = res.cited.filter((id) => ins.has(id)).map((id) => { const i = ins.get(id)!; return { id, insightId: i.id, kind: i.kind, severity: i.severity ?? null, confidence: i.confidence, status: i.status, evidence: i.evidence.map((e) => ({ id: e, text: byId.get(e) ?? "" })) }; });
  return {
    q, answer: res.answer, abstained: !!res.abstained, lowConfidence: low, research, reason, derived, cited: res.cited.map((id) => ({ id, text: res.memories.find((m) => m.id === id)?.text ?? "" })), shown,
    evidence: ev.evidence, threshold, embedMs, recallMs, answerMs, readerMs,
    tokens: { sent: promptTokens, completion: completionTokens, fullHistory: fullTokens, memories: all.length },
    cost: {
      usd: costUsd, fullUsd, savedPct: fullUsd ? Math.round((1 - costUsd / fullUsd) * 100) : null,
      lines: calls.map((c) => ({ kind: c.kind, model: c.model, promptTokens: c.promptTokens, completionTokens: c.completionTokens, usd: c.usd, price: price(cfg, c.model) })),
      embedUsd: sum(embed, "usd"), readerUsd: sum(chat, "usd"),
    },
    session: s, wallet: w,
    learning: a.learning ? res.cited.map((id) => ({ before: before.get(id) ?? null, after: after.get(id) ?? null })) : null,
  };
}

async function inspect(ctx: RouteContext) {
  const { cm, cfg, query, viewer } = ctx;
  const q = String(query.get("q") ?? "").trim();
  if (!q) throw new HttpError(400, "q required");
  const all = await vrows(ctx);
  const text = new Map(all.map((r) => [r.lesson_id, r.text]));
  const kw = bm25(q, all.map((r) => ({ id: r.lesson_id, text: r.text }))).slice(0, 20);
  const emb = (cm as unknown as { opts: { embedder?: (t: string[]) => Promise<number[][]> } }).opts.embedder;
  let vh: { id: string; score: number }[] = [];
  if (emb) {
    const [qe] = await emb([q]);
    vh = all.filter((r) => r.embedding).map((r) => ({ id: r.lesson_id, score: cosineSim(Float32Array.from(qe!), vec(r.embedding!)) }))
      .filter((x) => x.score >= cfg.recall.minSimilarity).sort((a, b) => b.score - a.score).slice(0, 20);
  }
  const a = retr(cfg);
  const fused = rrf([kw, vh], a.rrfK);
  const kwRank = new Map(kw.map((x, i) => [x.id, i + 1])), vRank = new Map(vh.map((x, i) => [x.id, i + 1]));
  const t0 = performance.now();
  const ev = await cm.recallWithEvidence(q, K, undefined, viewer);
  const recallMs = Math.round(performance.now() - t0);
  const kept = new Set(ev.memories.map((m) => m.id));
  const final = ev.candidates.map((m, i) => ({ rank: i + 1, id: m.id, text: m.text, score: m.score ?? null, kept: kept.has(m.id) }));
  const finalIds = new Set(final.map((f) => f.id));
  const row = (x: { id: string; score: number }) => ({ ...x, score: Number(x.score.toFixed(4)), text: text.get(x.id) ?? "" });
  return {
    q, fusion: a.fusion, rrfK: a.rrfK, k: K, minSimilarity: cfg.recall.minSimilarity,
    keyword: kw.slice(0, 10).map(row), vector: vh.slice(0, 10).map(row),
    fused: fused.slice(0, 12).map((x) => ({ ...row(x), kwRank: kwRank.get(x.id) ?? null, vecRank: vRank.get(x.id) ?? null, inFinal: finalIds.has(x.id) })),
    final, recallMs, evidence: ev.evidence, abstained: ev.abstained,
    cut: fused.filter((x) => !finalIds.has(x.id)).slice(0, 8).map((x) => ({ ...row(x), why: `below top-${K} after fusion${a.learning ? " + learned re-scoring" : ""}` })),
    note: "Keyword (BM25) and vector (Qwen3 cosine) channels are recomputed here for display; 'final' is the engine's actual recall.",
  };
}

async function timeline(ctx: RouteContext) {
  const rs = await vrows(ctx, false);
  const byId = new Map(rs.map((r) => [r.lesson_id, r]));
  const items = rs.map((r) => {
    const x = JSON.parse(r.extra || "{}");
    return { id: r.lesson_id, text: r.text, status: r.status, createdAt: r.created_at, replacedBy: r.replaced_by, replacedByText: r.replaced_by ? byId.get(r.replaced_by)?.text ?? null : null, supersedes: (x.supersedes ?? []) as string[], key: x.key ?? null };
  });
  const changed = items.filter((i) => i.status === "replaced" || i.supersedes.length);
  return { items: items.slice(-200), changed, superseded: items.filter((i) => i.status === "replaced").length };
}

async function learning(ctx: RouteContext) {
  const { cfg, query } = ctx;
  const on = retr(cfg).learning;
  const ids = (query.get("ids") ?? "").split(",").filter(Boolean);
  const all = (await vrows(ctx)).map((r) => learnRow(r, cfg));
  const seen = new Set(all.map((r) => r.id));
  for (const r of all) r.links = r.links.filter((l) => seen.has(l.id));
  const pick = ids.length ? all.filter((r) => ids.includes(r.id)) : all.filter((r) => r.count > 0 || r.accesses > 0).sort((a, b) => b.count - a.count).slice(0, 25);
  const text = new Map(all.map((r) => [r.id, r.text]));
  return { enabled: on, experimental: true, items: pick.map((p) => ({ ...p, links: p.links.map((l) => ({ ...l, text: text.get(l.id) ?? "" })) })), model: (null as unknown) };
}

async function forget({ cm, cfg, user, body, viewer }: RouteContext) {
  const id = String((await body(1000)).id ?? "");
  if (!(await cm.canSee(id, viewer))) throw new HttpError(404, "no such memory");
  const ok = await cm.forget(id);
  audit(cfg, user, "hard-forget", [id], { ok });
  return { ok, id, gone: !rows(cfg, user, false).some((r) => r.lesson_id === id) };
}

async function redact(ctx: RouteContext) {
  const { cm, cfg, user, body, useModel, viewer } = ctx;
  const id = String((await body(1000)).id ?? "");
  const r = (await vrows(ctx)).find((x) => x.lesson_id === id);
  if (!r) throw new HttpError(404, "memory not found");
  const out = redactText(r.text);
  if (!out.detections.length) return { ok: false, id, reason: "nothing sensitive detected (email, phone, card, key, password)" };
  useModel();
  const nu = await cm.update(id, out.text, { viewer });
  // a redaction edits the same event: keep its original time so time-based mining (habits, runs) is unaffected
  { const d = new DatabaseSync(join(cfg.dataDir, "memory.db")); try { d.prepare("UPDATE lessons SET created_at=? WHERE lesson_id=?").run(r.created_at, nu.id); } finally { d.close(); } }
  const purged = retr(cfg).hardForget ? await cm.forget(id) : false;
  audit(cfg, user, "redact", [id, nu.id], { detectors: out.detections.map((d) => d.detector), originalPurged: purged });
  return { ok: true, id, newId: nu.id, text: nu.text, detections: out.detections, originalPurged: purged };
}

function auditLog({ cfg, user }: RouteContext) {
  const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
  const demo = read(auditFile(cfg)).filter((e) => e.user === user).map((e) => ({ at: e.at, op: e.op, ids: e.ids, detail: e.detectors ? `detectors: ${e.detectors.join(", ")}${e.originalPurged ? "; original hard-deleted" : ""}` : e.ok === undefined ? "" : e.ok ? "deleted" : "not found" , source: "privacy" }));
  const chain = read(join(cfg.dataDir, "audit.jsonl")).filter((e) => e.scope?.userId === user).map((e) => ({ at: e.at, op: e.op, ids: e.ids, detail: `seq ${e.seq}, hash ${String(e.hash).slice(0, 10)}`, source: "hash-chained" }));
  return { items: [...demo, ...chain].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 100) };
}

async function privacyList(ctx: RouteContext) {
  const { cfg } = ctx, vis = await vrows(ctx);
  return { hardForget: retr(cfg).hardForget, redaction: retr(cfg).redaction, items: (() => {
    // Sensitive memories first (all of them), then the newest others, capped at 60 rows.
    const all = vis.reverse().map((r) => ({ id: r.lesson_id, text: r.text, sensitive: redactText(r.text).detections.map((d) => d.detector) }));
    const hot = all.filter((m) => m.sensitive.length);
    return [...hot, ...all.filter((m) => !m.sensitive.length).slice(0, Math.max(0, 60 - hot.length))];
  })() };
}

/** LongMemEval numbers from the newest eval run (CLEARMIND_DEMO_EVAL_DIR: per_question.jsonl + REPORT.md). */
export function numbers(dir = process.env.CLEARMIND_DEMO_EVAL_DIR ?? "") {
  const pq = join(dir, "per_question.jsonl");
  if (!dir || !existsSync(pq)) return { available: false };
  const rs = readFileSync(pq, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const n = rs.length, mean = (k: string) => rs.reduce((a, r) => a + (r[k] ?? 0), 0) / Math.max(1, n);
  const pct = (xs: any[], k: string, p: number) => { const v = xs.map((r) => r[k] ?? 0).sort((a: number, b: number) => a - b); return v[Math.min(v.length - 1, Math.floor(p * v.length))] ?? 0; };
  const abs = rs.filter((r) => r.is_abs), ans = rs.filter((r) => !r.is_abs);
  let cfg: any = {}; try { cfg = JSON.parse(readFileSync(join(dir, "cfg-full500.json"), "utf8")); } catch { /* optional */ }
  const types: Record<string, { n: number; ok: number }> = {};
  for (const r of rs) { const t = (types[r.question_type] ??= { n: 0, ok: 0 }); t.n++; if (r.label) t.ok++; }
  return {
    available: true, scored: n, total: 500, updatedAt: statSync(pq).mtime.toISOString(), reader: cfg.answer_model ?? null, judge: cfg.judge_model ?? null,
    accuracy: rs.filter((r) => r.label).length / Math.max(1, n),
    abstention: { absQuestions: abs.length, absCorrect: abs.filter((r) => r.abstained).length, falseAbstain: ans.filter((r) => r.abstained).length, answerable: ans.length },
    tokens: { meanIn: Math.round(mean("answer_tokens_in")), meanOut: Math.round(mean("answer_tokens_out")), meanFull: Math.round(mean("full_context_tokens")) },
    latency: { recallP50: pct(rs, "recall_ms", 0.5), recallP95: pct(rs, "recall_ms", 0.95), answerP50: pct(rs, "answer_ms", 0.5) },
    cost: { totalUsd: rs.reduce((a, r) => a + (r.nebius_cost_usd ?? 0), 0), perQuestionUsd: mean("nebius_cost_usd") },
    types, note: "open reader/judge; not comparable to leaderboard numbers",
  };
}

const cfgView = ({ cfg, user }: RouteContext) => {
  const a = retr(cfg);
  return {
    reader: cfg.nebius.chatModel, embed: cfg.nebius.embedModel, prices: { reader: price(cfg, cfg.nebius.chatModel), embed: price(cfg, cfg.nebius.embedModel) },
    fusion: a.fusion, rrfK: a.rrfK, learning: a.learning, hardForget: a.hardForget, redaction: a.redaction, audit: a.audit, k: K,
    wallet: readWallet(cfg, user), startCredit: START_CREDIT_USD, minBalance: MIN_BALANCE_USD, samples: SAMPLE_QUESTIONS,
  };
};

// ---------- local semantic index for the composer filters: nomic-embed-text-v1.5 on this machine (no LLM, no Nebius) ----------
// Item vectors are computed once (ONNX q8, one CPU thread), Matryoshka-truncated to 256-d, int8, cached in the data dir.
export const LOCAL_MODEL = "nomic-ai/nomic-embed-text-v1.5", LOCAL_DIMS = 256;
const DEMO_DEPS = process.env.CLEARMIND_DEMO_DEPS ?? join(homedir(), "work/demo-deps/node_modules");
const MODELS = process.env.CLEARMIND_DEMO_MODELS_DIR ?? join(homedir(), "work/demo-deps/models");
let localPipe: Promise<(t: string[]) => Promise<Float32Array[]>> | null = null;
function localEmbed() {
  return (localPipe ??= (async () => {
    const tf: any = await import(pathToFileURL(join(DEMO_DEPS, "@huggingface/transformers/dist/transformers.node.mjs")).href);
    tf.env.allowRemoteModels = false; tf.env.localModelPath = MODELS + "/";
    const fe = await tf.pipeline("feature-extraction", LOCAL_MODEL, { dtype: "q8", session_options: { intraOpNumThreads: 1, interOpNumThreads: 1 } });
    return async (texts: string[]) => {
      const out = await fe(texts, { pooling: "mean" });
      const v = tf.layer_norm(out, [out.dims[1]]).slice(null, [0, LOCAL_DIMS]).normalize(2, -1);
      return (v.tolist() as number[][]).map((r) => Float32Array.from(r));
    };
  })());
}
const toI8 = (v: Float32Array) => Buffer.from(Int8Array.from(v, (x) => Math.max(-127, Math.min(127, Math.round(x * 127)))).buffer).toString("base64");
let localBusy: Promise<unknown> | null = null;
export async function localIndex(cfg: Config, user: string, extra: { lesson_id: string; text: string }[] = [], maxCompute = Infinity) {
  const file = join(cfg.dataDir, `local-emb.${user}.json`);
  let idx: { model: string; dims: number; items: Record<string, { h: string; v: string }> } = { model: LOCAL_MODEL, dims: LOCAL_DIMS, items: {} };
  try { const j = JSON.parse(readFileSync(file, "utf8")); if (j.model === LOCAL_MODEL && j.dims === LOCAL_DIMS) idx = j; } catch { /* new */ }
  const all = [...rows(cfg, user, false), ...extra] as { lesson_id: string; text: string }[], h = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);
  const need = all.filter((r) => idx.items[r.lesson_id]?.h !== h(r.text));
  let ms = 0;
  // in the server, a big backlog is not embedded in-process (it blocks the event loop); scripts/local-index.ts builds it
  if (need.length && need.length <= maxCompute) {
    while (localBusy) await localBusy;
    const t0 = performance.now();
    const job = (async () => {
      const emb = await localEmbed();
      for (let i = 0; i < need.length; i += 16) {
        const part = need.slice(i, i + 16), vs = await emb(part.map((r) => `search_document: ${r.text}`));
        part.forEach((r, k) => (idx.items[r.lesson_id] = { h: h(r.text), v: toI8(vs[k]!) }));
      }
      writeFileSync(file, JSON.stringify(idx));
    })();
    localBusy = job; try { await job; } finally { localBusy = null; }
    ms = Math.round(performance.now() - t0);
  }
  const live = new Set(all.map((r) => r.lesson_id));
  return { model: LOCAL_MODEL, dims: LOCAL_DIMS, quant: "int8/127", prefix: { query: "search_query: ", doc: "search_document: " }, computedMs: ms, computed: need.length,
    items: Object.entries(idx.items).filter(([id]) => live.has(id)).map(([id, x]) => ({ id, v: x.v })) };
}

// Server path for the same search: the query is embedded here with the same nomic model (kept warm in memory),
// and compared with the cached item vectors.
let localVecs: { key: string; ids: string[]; M: Float32Array } | null = null;
const semLat: number[] = [];
const pctl = (xs: number[], p: number) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!; };
/** Entity profile texts (name, aliases, type, key fields) searched alongside memories. */
export const entityDocs = (cm: RouteContext["cm"]) => { try { return cm.entities.list({ limit: 2000 }).map((e) => ({ lesson_id: e.id, text: cm.entities.profileText(e.id) })); } catch { return []; } };
const mtime = (p: string) => (existsSync(p) ? statSync(p).mtimeMs : 0);
async function localSemantic({ cm, cfg, user, query, viewer }: RouteContext) {
  const q = String(query.get("q") ?? "").trim().toLowerCase().slice(0, 300);
  if (!q) throw new HttpError(400, "q required");
  const key = `${user}:${mtime(join(cfg.dataDir, "memory.db"))}:${mtime(join(cfg.dataDir, "entities.db-wal"))}:${mtime(join(cfg.dataDir, "entities.db"))}:${mtime(join(cfg.dataDir, `local-emb.${user}.json`))}`;
  if (localVecs?.key !== key) {
    const ix = await localIndex(cfg, user, entityDocs(cm), 300), D = ix.dims, M = new Float32Array(ix.items.length * D);
    ix.items.forEach((x, i) => { const a = new Int8Array(Buffer.from(x.v, "base64")); for (let k = 0; k < D; k++) M[i * D + k] = a[k]! / 127; });
    localVecs = { key, ids: ix.items.map((x) => x.id), M };
  }
  const t0 = performance.now();
  const [v] = await (await localEmbed())([`search_query: ${q}`]);
  const embedMs = performance.now() - t0; semLat.push(embedMs); if (semLat.length > 500) semLat.shift();
  const { ids, M } = localVecs, D = LOCAL_DIMS, out: { id: string; cos: number }[] = [];
  for (let i = 0; i < ids.length; i++) { let c = 0; for (let k = 0; k < D; k++) c += v![k]! * M[i * D + k]!; out.push({ id: ids[i]!, cos: Number(c.toFixed(4)) }); }
  out.sort((a, b) => b.cos - a.cos);
  // viewer filter on the ranked ids: memories via the acl, entities via visibleEntityIds
  const [vm, ve] = [await cm.visibleMemoryIds(viewer), await cm.visibleEntityIds(viewer)];
  if (vm) for (let i = out.length - 1; i >= 0; i--) if (!vm.has(out[i]!.id) && !ve!.has(out[i]!.id)) out.splice(i, 1);
  return { q, model: LOCAL_MODEL, embedMs: Math.round(embedMs * 10) / 10, hits: out, stats: { n: semLat.length, p50: pctl(semLat, 50), p95: pctl(semLat, 95) } };
}

export const demoRoutes: Route[] = [
  { method: "GET", path: "/api/demo/config", handle: cfgView },
  // written by the former scripts/seed-judges.ts (demo-only; replaced by scripts/tavily-research.ts + ingest); absent when the dir has no web data
  { method: "GET", path: "/api/demo/seed-info", handle: (ctx) => { const p = join(ctx.cfg.dataDir, "demo-seed.json"); return existsSync(p) ? { available: true, ...JSON.parse(readFileSync(p, "utf8")) } : { available: false }; } },
  { method: "POST", path: "/api/demo/ask", handle: ask },
  { method: "GET", path: "/api/demo/inspect", handle: inspect },
  { method: "GET", path: "/api/demo/semantic", handle: localSemantic },
  { method: "GET", path: "/api/demo/timeline", handle: timeline },
  { method: "GET", path: "/api/demo/learning", handle: learning },
  { method: "GET", path: "/api/demo/privacy", handle: privacyList },
  { method: "POST", path: "/api/demo/forget", handle: forget },
  { method: "POST", path: "/api/demo/redact", handle: redact },
  { method: "GET", path: "/api/demo/audit", handle: auditLog },
  { method: "GET", path: "/api/demo/numbers", handle: () => numbers() },
  {
    method: "GET", path: "/api/demo/warm", handle: async ({ cm, cfg, user }) => {
      const emb = (cm as unknown as { opts: { embedder?: (t: string[]) => Promise<unknown> } }).opts.embedder;
      // one round trip keeps the connection warm; the sample questions are embedded once and memoised
      const t0 = performance.now(); if (emb) await Promise.all(SAMPLE_QUESTIONS.map((q) => emb([q])));
      const ms = Math.round(performance.now() - t0);
      // pre-warm likely filter queries in the background: sample questions, insight titles, entity names, kinds
      // keep the local nomic model and the item vectors warm for the server semantic path
      // (no local index build here: on a store of thousands of memories it embeds every item in-process and blocks
      // the event loop for minutes; build it out of process with scripts/local-index.ts)
      return { warmed: !!emb, ms, questions: SAMPLE_QUESTIONS.length };
    },
  },
  { method: "GET", path: "/api/demo/wallet", handle: ({ cfg, user }) => readWallet(cfg, user) },
  {
    method: "POST", path: "/api/demo/topup", handle: async ({ cfg, user, body }) => {
      const amt = Math.min(20, Math.max(0, Number((await body(1000)).usd ?? 5)));
      const w = readWallet(cfg, user); w.balanceUsd += amt; addLedger(w, "topup", amt, "demo top-up"); saveWallet(cfg, user, w);
      audit(cfg, user, "demo-topup", [], { usd: amt });
      return w;
    },
  },
  {
    method: "POST", path: "/api/demo/set-balance", handle: async ({ cfg, user, body }) => {
      const w = readWallet(cfg, user); const was = w.balanceUsd; w.balanceUsd = Math.max(0, Number((await body(1000)).usd ?? 0)); addLedger(w, "set", w.balanceUsd - was, "balance set (test)"); saveWallet(cfg, user, w); return w;
    },
  },
];
