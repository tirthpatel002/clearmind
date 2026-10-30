// Demo routes for the hackathon UI: chat with cost/credits, recall inspector, timeline, learning, privacy, numbers.
// Everything here reads the same per-user store the app uses; nothing is mocked except the demo wallet.
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  "Why did my grocery order agent fail last week, and is it fixed?",
  "What do I usually do on Friday evenings?",
  "Any security issues I should know about?",
  "What is the fastest way you have learned to file my expenses?",
  "What do I usually ask you in the morning?",
  "What time is my daily standup now?",
  "What is my passport number?",
];

/** Demo wallet: starting credit (USD), stored in <dataDir>/demo-wallet.json. Not real money. */
export const START_CREDIT_USD = 5;
/** Refuse an answer when the balance is below this (USD). */
export const MIN_BALANCE_USD = 0.005;
const K = 6;

type Wallet = { balanceUsd: number; spentUsd: number; answers: number; sessions: Record<string, { usd: number; fullUsd: number; answers: number }> };

const retr = (cfg: Config) => ({ ...RETRIEVAL_DEFAULTS, ...(cfg.retrieval ?? {}) });
const walletFile = (cfg: Config, user: string) => join(cfg.dataDir, `demo-wallet.${user}.json`);
export function readWallet(cfg: Config, user: string): Wallet {
  try { return JSON.parse(readFileSync(walletFile(cfg, user), "utf8")); } catch { return { balanceUsd: START_CREDIT_USD, spentUsd: 0, answers: 0, sessions: {} }; }
}
const saveWallet = (cfg: Config, user: string, w: Wallet) => writeFileSync(walletFile(cfg, user), JSON.stringify(w, null, 1));

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

function ledgerSince(cfg: Config, offset: number) {
  const p = join(cfg.dataDir, "spend.jsonl");
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").slice(offset).split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
const ledgerSize = (cfg: Config) => { const p = join(cfg.dataDir, "spend.jsonl"); return existsSync(p) ? statSync(p).size : 0; };
const price = (cfg: Config, m: string) => cfg.nebius.prices[m] ?? { in: 1, out: 3 };

async function ask({ cm, cfg, user, body, useModel }: RouteContext) {
  const b = await body(10_000);
  const q = String(b.q ?? "").trim(), session = String(b.session ?? "default").slice(0, 64);
  if (!q) throw new HttpError(400, "question required");
  const w = readWallet(cfg, user);
  if (w.balanceUsd < MIN_BALANCE_USD) {
    return { refused: true, reason: `Your demo credit balance ($${w.balanceUsd.toFixed(4)}) is below the $${MIN_BALANCE_USD.toFixed(3)} needed for one answer. Top up demo credits to continue.`, wallet: w };
  }
  useModel();
  const off = ledgerSize(cfg);
  const t0 = performance.now();
  const ev = await cm.recallWithEvidence(q, K);
  const recallMs = Math.round(performance.now() - t0);
  const before = new Map(rows(cfg, user).map((r) => [r.lesson_id, learnRow(r, cfg)]));
  const t1 = performance.now();
  const res = await cm.ask(q, { k: K, recalled: ev }); // single recall, reused
  const answerMs = Math.round(performance.now() - t1);
  const readerMs = (res as { usage?: { ms?: number } }).usage?.ms ?? null;
  const calls = ledgerSince(cfg, off).filter((e) => e.user === user);
  const embed = calls.filter((c) => c.kind === "embed"), chat = calls.filter((c) => c.kind === "chat");
  const sum = (xs: any[], k: string) => xs.reduce((a, x) => a + (x[k] ?? 0), 0);
  const costUsd = sum(calls, "usd");
  const promptTokens = sum(chat, "promptTokens"), completionTokens = sum(chat, "completionTokens");
  const all = rows(cfg, user);
  const fullTokens = all.reduce((a, r) => a + approxTokens(`[${r.lesson_id}] ${r.text}\n`), 0) + approxTokens(q) + 200;
  const rp = price(cfg, cfg.nebius.chatModel);
  const fullUsd = (fullTokens * rp.in + completionTokens * rp.out) / 1e6;
  w.balanceUsd = Math.max(0, w.balanceUsd - costUsd); w.spentUsd += costUsd; w.answers++;
  const s = (w.sessions[session] ??= { usd: 0, fullUsd: 0, answers: 0 });
  s.usd += costUsd; s.fullUsd += fullUsd; s.answers++;
  saveWallet(cfg, user, w);
  const a = retr(cfg), ab = cfg.recall.abstain;
  const threshold = ev.cosine === null ? ab.minEvidenceLexical : ab.minEvidence;
  let reason: string | null = null;
  if (res.abstained) reason = ev.abstained
    ? (ev.candidates.length ? `No supporting memory found: best evidence ${ev.evidence.toFixed(2)} is below the ${threshold} threshold, so nothing was sent as fact.` : "No supporting memory found: recall returned no candidates.")
    : "No supporting memory found: the reader judged none of the recalled memories relevant.";
  const after = new Map(rows(cfg, user).map((r) => [r.lesson_id, learnRow(r, cfg)]));
  const shown = res.memories.map((m) => ({ id: m.id, text: m.text, createdAt: m.createdAt, score: m.score ?? null }));
  // cited insights: show what Clearmind derived them from
  const ins = new Map(readInsights(cfg, user).insights.filter((i) => i.memoryId).map((i) => [i.memoryId!, i]));
  const byId = new Map(all.map((r) => [r.lesson_id, r.text]));
  const derived = res.cited.filter((id) => ins.has(id)).map((id) => { const i = ins.get(id)!; return { id, insightId: i.id, kind: i.kind, severity: i.severity ?? null, confidence: i.confidence, status: i.status, evidence: i.evidence.map((e) => ({ id: e, text: byId.get(e) ?? "" })) }; });
  return {
    q, answer: res.answer, abstained: !!res.abstained, reason, derived, cited: res.cited.map((id) => ({ id, text: res.memories.find((m) => m.id === id)?.text ?? "" })), shown,
    evidence: ev.evidence, threshold, recallMs, answerMs, readerMs,
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

async function inspect({ cm, cfg, user, query }: RouteContext) {
  const q = String(query.get("q") ?? "").trim();
  if (!q) throw new HttpError(400, "q required");
  const all = rows(cfg, user);
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
  const ev = await cm.recallWithEvidence(q, K);
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

function timeline({ cfg, user }: RouteContext) {
  const rs = rows(cfg, user, false);
  const byId = new Map(rs.map((r) => [r.lesson_id, r]));
  const items = rs.map((r) => {
    const x = JSON.parse(r.extra || "{}");
    return { id: r.lesson_id, text: r.text, status: r.status, createdAt: r.created_at, replacedBy: r.replaced_by, replacedByText: r.replaced_by ? byId.get(r.replaced_by)?.text ?? null : null, supersedes: (x.supersedes ?? []) as string[], key: x.key ?? null };
  });
  const changed = items.filter((i) => i.status === "replaced" || i.supersedes.length);
  return { items: items.slice(-200), changed, superseded: items.filter((i) => i.status === "replaced").length };
}

function learning({ cfg, user, query }: RouteContext) {
  const on = retr(cfg).learning;
  const ids = (query.get("ids") ?? "").split(",").filter(Boolean);
  const all = rows(cfg, user).map((r) => learnRow(r, cfg));
  const pick = ids.length ? all.filter((r) => ids.includes(r.id)) : all.filter((r) => r.count > 0 || r.accesses > 0).sort((a, b) => b.count - a.count).slice(0, 25);
  const text = new Map(all.map((r) => [r.id, r.text]));
  return { enabled: on, experimental: true, items: pick.map((p) => ({ ...p, links: p.links.map((l) => ({ ...l, text: text.get(l.id) ?? "" })) })), model: (null as unknown) };
}

async function forget({ cm, cfg, user, body }: RouteContext) {
  const id = String((await body(1000)).id ?? "");
  const ok = await cm.forget(id);
  audit(cfg, user, "hard-forget", [id], { ok });
  return { ok, id, gone: !rows(cfg, user, false).some((r) => r.lesson_id === id) };
}

async function redact({ cm, cfg, user, body, useModel }: RouteContext) {
  const id = String((await body(1000)).id ?? "");
  const r = rows(cfg, user).find((x) => x.lesson_id === id);
  if (!r) throw new HttpError(404, "memory not found");
  const out = redactText(r.text);
  if (!out.detections.length) return { ok: false, id, reason: "nothing sensitive detected (email, phone, card, key, password)" };
  useModel();
  const nu = await cm.update(id, out.text);
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

function privacyList({ cfg, user }: RouteContext) {
  return { hardForget: retr(cfg).hardForget, redaction: retr(cfg).redaction, items: (() => {
    // Sensitive memories first (all of them), then the newest others, capped at 60 rows.
    const all = rows(cfg, user).reverse().map((r) => ({ id: r.lesson_id, text: r.text, sensitive: redactText(r.text).detections.map((d) => d.detector) }));
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

export const demoRoutes: Route[] = [
  { method: "GET", path: "/api/demo/config", handle: cfgView },
  { method: "POST", path: "/api/demo/ask", handle: ask },
  { method: "GET", path: "/api/demo/inspect", handle: inspect },
  { method: "GET", path: "/api/demo/timeline", handle: timeline },
  { method: "GET", path: "/api/demo/learning", handle: learning },
  { method: "GET", path: "/api/demo/privacy", handle: privacyList },
  { method: "POST", path: "/api/demo/forget", handle: forget },
  { method: "POST", path: "/api/demo/redact", handle: redact },
  { method: "GET", path: "/api/demo/audit", handle: auditLog },
  { method: "GET", path: "/api/demo/numbers", handle: () => numbers() },
  {
    method: "GET", path: "/api/demo/warm", handle: async ({ cm }) => {
      const emb = (cm as unknown as { opts: { embedder?: (t: string[]) => Promise<unknown> } }).opts.embedder;
      // one round trip keeps the connection warm; the sample questions are embedded once and memoised
      const t0 = performance.now(); if (emb) await Promise.all(SAMPLE_QUESTIONS.map((q) => emb([q])));
      return { warmed: !!emb, ms: Math.round(performance.now() - t0), questions: SAMPLE_QUESTIONS.length };
    },
  },
  { method: "GET", path: "/api/demo/wallet", handle: ({ cfg, user }) => readWallet(cfg, user) },
  {
    method: "POST", path: "/api/demo/topup", handle: async ({ cfg, user, body }) => {
      const amt = Math.min(20, Math.max(0, Number((await body(1000)).usd ?? 5)));
      const w = readWallet(cfg, user); w.balanceUsd += amt; saveWallet(cfg, user, w);
      audit(cfg, user, "demo-topup", [], { usd: amt });
      return w;
    },
  },
  {
    method: "POST", path: "/api/demo/set-balance", handle: async ({ cfg, user, body }) => {
      const w = readWallet(cfg, user); w.balanceUsd = Math.max(0, Number((await body(1000)).usd ?? 0)); saveWallet(cfg, user, w); return w;
    },
  },
];
