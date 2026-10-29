// LongMemEval-S end-to-end evaluation of Clearmind: ingest -> recall -> answer -> judge, fully traced with @hackkit/observe.
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx eval/longmemeval/run.ts --config <cfg.json> --phase <name> --split dev|heldout|all [--limit N] [--ids a,b]
import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chat, embed, setConfig, loadConfigSync } from "@hackkit/connector";
import { startRun, BudgetExceededError, type Run } from "@hackkit/observe";
import { bm25Similarities, cosine } from "agentmemory";
import { Clearmind, DEFAULTS, NO_MEMORY } from "@clearmind/core";
import type { Config as CmConfig } from "@clearmind/core";
import { loadDataset, chunksFor, parseLmeDate, type Question, type Chunk } from "./data.js";
import { sessionMetrics } from "./metrics.js";
import { anscheckPrompt, parseVerdict, stripThink } from "./judge.js";

export interface EvalConfig {
  name: string;
  dataset: { path: string; sha256: string };
  split: { dev_ids_file: string };
  connector_config: string;
  answer_model: string; judge_model: string; judge_label: string; embed_model: string;
  chunk_max_chars: number; k: number; metrics_depth: number;
  clearmind: { recall: CmConfig["recall"]; features?: CmConfig["features"]; retrieval?: CmConfig["retrieval"] };
  answer: { max_tokens: number; temperature: number; date_instruction: string };
  judge: { max_tokens: number; temperature: number };
  concurrency: { questions: number; model_calls: number; embed_requests: number; embed_batch: number };
  prices: any; budgets_total: { gpu_sec: Record<string, number>; usd_by_provider: Record<string, number> };
  baselines: { retrieval: string[] };
  emb_cache_dir: string; work_dir: string;
}

const args = new Map<string, string>(); for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i]!.replace(/^--/, ""), process.argv[i + 1] ?? "");
const cfgPath = resolve(args.get("config") ?? "eval/longmemeval/configs/pilot-modal.json");
const cfg: EvalConfig = JSON.parse(readFileSync(cfgPath, "utf8"));
const phase = args.get("phase") ?? "smoke";
const ROOT = resolve(args.get("run-root") ?? cfg.work_dir);
const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), "../..");

setConfig(loadConfigSync(resolve(repoRoot, cfg.connector_config)));

// ---------- data + split ----------
const { questions: all, sha256 } = loadDataset(cfg.dataset.path);
if (sha256 !== cfg.dataset.sha256) throw new Error(`dataset sha256 mismatch: ${sha256}`);
const devFile = JSON.parse(readFileSync(cfg.split.dev_ids_file, "utf8"));
const devIds = new Set<string>(devFile.question_ids ?? devFile.dev_ids);
const split = args.get("split") ?? "dev";
let qs: Question[] = split === "dev" ? all.filter((q) => devIds.has(q.question_id)) : split === "heldout" ? all.filter((q) => !devIds.has(q.question_id)) : all;
if (args.get("ids")) { const want = new Set(args.get("ids")!.split(",")); qs = qs.filter((q) => want.has(q.question_id)); }
if (args.get("limit")) qs = qs.slice(0, Number(args.get("limit")));
if (split === "heldout" && qs.some((q) => devIds.has(q.question_id))) throw new Error("held-out set leaks dev ids");

// ---------- run + budgets (remaining across earlier phases of this run root) ----------
function priorSpend(): { gpu: Record<string, number>; usd: Record<string, number> } {
  const gpu: Record<string, number> = {}, usd: Record<string, number> = {};
  for (const d of existsSync(ROOT) ? readdirSync(ROOT) : []) {
    if (d === phase) continue;
    const m = (() => { try { return JSON.parse(readFileSync(join(ROOT, d, "manifest.json"), "utf8")); } catch { return null; } })();
    const t = m?.totals; if (!t) continue;
    for (const [k, g] of Object.entries<any>(t.gpu ?? {})) gpu[k] = (gpu[k] ?? 0) + g.billedSec;
    for (const [p, a] of Object.entries<any>(t.byProvider ?? {})) usd[p] = (usd[p] ?? 0) + a.usd + a.gpuUsd;
  }
  return { gpu, usd };
}
const prior = priorSpend();
const budgets = {
  maxGpuSec: Object.fromEntries(Object.entries(cfg.budgets_total.gpu_sec).map(([k, v]) => [k, Math.max(0, v - (prior.gpu[k] ?? 0))])),
  maxUsdByProvider: Object.fromEntries(Object.entries(cfg.budgets_total.usd_by_provider).map(([k, v]) => [k, Math.max(0, v - (prior.usd[k] ?? 0))])),
};
const frozen = { ...cfg, split_name: split, n_questions: qs.length, question_ids_sha256: createHash("sha256").update(qs.map((q) => q.question_id).join(",")).digest("hex"), dev_ids_file_sha256: createHash("sha256").update(readFileSync(cfg.split.dev_ids_file)).digest("hex") };
const run: Run = startRun({
  dir: join(ROOT, phase), name: `${cfg.name}/${phase}`, config: frozen, resume: true, prices: cfg.prices, budgets,
  gitRepos: { clearmind: repoRoot, agentmemory: resolve(repoRoot, "node_modules/agentmemory"), hackkit: resolve(repoRoot, "node_modules/@hackkit/observe") },
  versions: { node: process.version },
});
const RD = run.dir; mkdirSync(join(RD, "traces"), { recursive: true });
writeFileSync(join(RD, "config.used.json"), JSON.stringify({ ...frozen, budgets_this_phase: budgets, prior_spend: prior }, null, 2));
const recFile = join(RD, "records.jsonl");
const done = new Set<string>(existsSync(recFile) ? readFileSync(recFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).question_id) : []);
run.event("phase.start", { split, n: qs.length, already_done: done.size, budgets });
console.error(`[${phase}] ${qs.length} questions (${done.size} already done), split=${split}, run dir ${RD}`);

// ---------- embedding cache (disk, sharded) ----------
const EC = cfg.emb_cache_dir; mkdirSync(EC, { recursive: true });
const ekey = (t: string) => createHash("sha1").update(cfg.embed_model + "\0" + t).digest("hex");
const efile = (k: string) => join(EC, k.slice(0, 2), k);
const memo = new Map<string, Float32Array>();
function cached(t: string): Float32Array | null {
  const k = ekey(t); const m = memo.get(k); if (m) return m;
  const f = efile(k); if (!existsSync(f)) return null;
  const b = readFileSync(f); const v = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); if (memo.size < 50_000) memo.set(k, v); return v;
}
function store(t: string, v: Float32Array) { const k = ekey(t); mkdirSync(join(EC, k.slice(0, 2)), { recursive: true }); writeFileSync(efile(k), Buffer.from(v.buffer, v.byteOffset, v.byteLength)); }
// Nebius embedding quota is 600k tokens/min: pace below it and back off on 429/5xx.
const TPM = 540_000; const sent: { t: number; n: number }[] = [];
async function pace(n: number) {
  for (;;) { const now = Date.now(); while (sent.length && now - sent[0]!.t > 60_000) sent.shift();
    const used = sent.reduce((s, x) => s + x.n, 0); if (used + n <= TPM || !sent.length) { sent.push({ t: now, n }); return; }
    await new Promise((r) => setTimeout(r, 60_000 - (now - sent[0]!.t) + 50)); }
}
async function embedRetry(b: string[], label: string): Promise<Float32Array[]> {
  for (let a = 0; ; a++) {
    await pace(Math.round(b.reduce((s, t) => s + t.length, 0) / 3.5));
    try { return await run.stage("embed", () => embed(b, { model: cfg.embed_model }), { batch: b.length, label, outer_attempt: a + 1 }); }
    catch (e: any) { const st = e?.opts?.status ?? e?.status; if (a >= 10 || !(st === 429 || st >= 500 || st === undefined) || e instanceof BudgetExceededError) throw e;
      const w = Math.min(65_000, 4_000 * 2 ** a); run.event?.("embed_backoff", { status: st ?? null, wait_ms: w, attempt: a + 1 }); console.error(`  embed backoff ${w}ms (status ${st})`); await new Promise((r) => setTimeout(r, w)); }
  }
}
async function embedMissing(texts: string[], label: string): Promise<{ missing: number; estTokens: number }> {
  const miss = [...new Set(texts)].filter((t) => !cached(t));
  const estTokens = Math.round(miss.reduce((s, t) => s + t.length, 0) / 4);
  if (!miss.length) return { missing: 0, estTokens: 0 };
  const B = cfg.concurrency.embed_batch, batches: string[][] = [];
  for (let i = 0; i < miss.length; i += B) batches.push(miss.slice(i, i + B));
  let next = 0, doneB = 0;
  await Promise.all(Array.from({ length: cfg.concurrency.embed_requests }, async () => {
    while (next < batches.length && !run.stopped) {
      const b = batches[next++]!;
      const vs = await embedRetry(b, label);
      vs.forEach((v, i) => store(b[i]!, v));
      if (++doneB % 20 === 0 || doneB === batches.length) { run.setProgressExtra({ embed: `${doneB}/${batches.length} batches (${label})` }); console.error(`  embed ${label}: ${doneB}/${batches.length}`); }
    }
  }));
  return { missing: miss.length, estTokens };
}
const cachedEmbedder = async (texts: string[]): Promise<Float32Array[]> => {
  const out: Float32Array[] = []; const miss = texts.filter((t) => !cached(t));
  if (miss.length) { const vs = await embedRetry([...new Set(miss)], "query"); [...new Set(miss)].forEach((t, i) => store(t, vs[i]!)); }
  for (const t of texts) out.push(cached(t)!);
  return out;
};

// ---------- model calls (bounded concurrency) ----------
let inflight = 0; const waiters: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  while (inflight >= cfg.concurrency.model_calls) await new Promise<void>((r) => waiters.push(r));
  inflight++; try { return await fn(); } finally { inflight--; waiters.shift()?.(); }
}

// ---------- truncation-aware chat: retry once with a higher limit, count every truncation ----------
async function chatT(model: string, msgs: any, o: { maxTokens: number; retryMaxTokens?: number; temperature: number; json?: boolean }, tr: { truncations: string[] }, what: string) {
  try { return await limited(() => chat(model, msgs, { maxTokens: o.maxTokens, temperature: o.temperature, ...(o.json ? { json: true } : {}) })); }
  catch (e: any) {
    if (e?.name !== "TruncatedError" && !/finish_reason "length"/.test(String(e?.message))) throw e;
    tr.truncations.push(`${what}@${o.maxTokens}`); run.event("truncation.retry", { what, max_tokens: o.maxTokens, retry_max_tokens: o.retryMaxTokens ?? o.maxTokens * 2 });
    try { return await limited(() => chat(model, msgs, { maxTokens: o.retryMaxTokens ?? o.maxTokens * 2, temperature: o.temperature, ...(o.json ? { json: true } : {}) })); }
    catch (e2: any) { if (e2?.name === "TruncatedError" || /finish_reason "length"/.test(String(e2?.message))) { tr.truncations.push(`${what}@${o.retryMaxTokens ?? o.maxTokens * 2}:FINAL`); const x = new Error(`TRUNCATED (${what}) after retry: ${e2.message}`); x.name = "TruncatedFinal"; throw x; } throw e2; }
  }
}

// ---------- per question ----------
const qChunks = (q: Question) => chunksFor(q, cfg.chunk_max_chars);
function rankRounds(scores: number[], chunks: Chunk[]): string[] {
  const order = scores.map((s, i) => [s, i] as const).sort((a, b) => b[0] - a[0]);
  const seen = new Set<string>(), out: string[] = [];
  for (const [, i] of order) { const r = chunks[i]!.roundId; if (!seen.has(r)) { seen.add(r); out.push(r); } }
  return out;
}

async function evalQuestion(q: Question): Promise<Record<string, unknown>> {
  const isAbs = q.question_id.endsWith("_abs");
  const chunks = qChunks(q);
  const allRounds = [...new Set(chunks.map((c) => c.roundId))];
  const answerRounds = [...new Set(chunks.filter((c) => c.hasAnswer).map((c) => c.roundId))];
  const qDate = parseLmeDate(q.question_date);
  let clock = qDate;
  const dir = join(tmpdir(), "lme-cm", run.id, q.question_id); rmSync(dir, { recursive: true, force: true });
  const lat: Record<string, number> = {}; const t = () => performance.now();
  const answerCalls: any[] = []; const tr = { truncations: [] as string[] };
  const cmCfg: CmConfig = { ...structuredClone(DEFAULTS), recall: cfg.clearmind.recall, features: cfg.clearmind.features, retrieval: cfg.clearmind.retrieval };
  const chatFn = async (messages: { role: string; content: string }[], o: { json?: boolean; maxTokens?: number } = {}) => {
    const msgs = messages.map((m, i) => (i === 0 && m.role === "system" ? { ...m, content: `${m.content}\n${cfg.answer.date_instruction.replace("{question_date}", q.question_date)}` } : m)) as any;
    const t0 = Date.now();
    const r = await chatT(cfg.answer_model, msgs, { maxTokens: cfg.answer.max_tokens, retryMaxTokens: (cfg.answer as any).retry_max_tokens, temperature: cfg.answer.temperature, json: o.json }, tr, "answer");
    const content = stripThink(r.text);
    answerCalls.push({ messages: msgs, raw: r.text, finish: r.finishReason, tokens_in: r.tokensIn, tokens_out: r.tokensOut });
    return { content, promptTokens: r.tokensIn ?? 0, completionTokens: r.tokensOut ?? 0, usd: r.costUsd ?? 0, model: r.model, ms: Date.now() - t0 };
  };
  const cm = new Clearmind({ answerPrompt: (cfg.answer as any).system_prompt || undefined, dir, ownerId: "lme", embedder: cachedEmbedder, chat: chatFn, now: () => clock, config: cmCfg, minSimilarity: cfg.clearmind.recall.minSimilarity });
  try {
    // ingest in chronological order with each session's own date as the clock
    let t0 = t();
    const order = chunks.map((c, i) => ({ c, i, d: parseLmeDate(c.date).getTime() })).sort((a, b) => a.d - b.d || a.i - b.i);
    const memToRound = new Map<string, string>(); let confirmed = 0;
    await run.stage("ingest", async () => {
      const vecs = await cachedEmbedder(order.map((o) => o.c.text));
      for (const [j, o] of order.entries()) {
        clock = new Date(o.d);
        const m = await cm.remember(o.c.text, { embedding: vecs[j]! });
        if ((m as any).confirmed) confirmed++; else memToRound.set(m.id, o.c.roundId);
      }
    }, { chunks: chunks.length });
    lat.ingest_ms = t() - t0;
    const replaced = (await cm.list(true)).filter((m) => m.status === "replaced").length;
    const sampleDates = (await cm.list()).slice(0, 2).map((m) => m.createdAt);

    // recall at the question date
    clock = qDate; t0 = t();
    const { ranked, ev } = await run.stage("recall", async () => {
      const ranked = await cm.recall(q.question, cfg.metrics_depth);
      const ev = await cm.recallWithEvidence(q.question, cfg.k);
      return { ranked, ev };
    });
    lat.recall_ms = t() - t0;
    const rankedRounds: string[] = []; for (const m of ranked) { const r = memToRound.get(m.id); if (r && !rankedRounds.includes(r)) rankedRounds.push(r); }
    const retrieval: Record<string, Record<string, number>> = {};
    if (!isAbs) retrieval.clearmind = sessionMetrics(rankedRounds, allRounds, answerRounds);

    // no-tuning baselines on the same chunks (full ranking, standard top-k)
    if (!isAbs && cfg.baselines.retrieval.length) {
      await run.stage("baselines", async () => {
        const texts = chunks.map((c) => c.text);
        if (cfg.baselines.retrieval.includes("bm25")) retrieval.bm25 = sessionMetrics(rankRounds(bm25Similarities(q.question, texts), chunks), allRounds, answerRounds);
        if (cfg.baselines.retrieval.includes("embedding")) {
          const [qe] = await cachedEmbedder([q.question]); const vs = await cachedEmbedder(texts);
          retrieval.embedding = sessionMetrics(rankRounds(vs.map((v) => cosine(qe!, v)), chunks), allRounds, answerRounds);
        }
      });
    }

    // answer through Clearmind.ask (owner path: recallWithEvidence gate + model with the abstention instruction)
    t0 = t();
    const ask = await run.stage("answer", () => cm.ask(q.question, { k: cfg.k }));
    lat.answer_ms = t() - t0;
    const hypothesis = ask.answer;
    const abstainedBy = ask.abstained ? (answerCalls.length ? "model" : "evidence-gate") : null;

    // judge with the official prompt
    t0 = t();
    const prompt = anscheckPrompt(q.question_type, q.question, String(q.answer), hypothesis, isAbs);
    const jr = await run.stage("judge", () => chatT(cfg.judge_model, [{ role: "user", content: prompt }], { maxTokens: cfg.judge.max_tokens, retryMaxTokens: (cfg.judge as any).retry_max_tokens, temperature: cfg.judge.temperature }, tr, "judge"));
    lat.judge_ms = t() - t0;
    const judgeRaw = parseVerdict(jr.text);
    // Deterministic rule (labelled in the report): on _abs questions, the exact NO_MEMORY reply is an abstention by construction.
    const judgeOverride = !!((cfg.judge as any).abs_exact_override && isAbs && hypothesis.trim() === NO_MEMORY && !judgeRaw);
    const label = judgeOverride ? true : judgeRaw;

    const retrievedTop = rankedRounds.slice(0, cfg.k);
    const trace = {
      question_id: q.question_id, question_type: q.question_type, question: q.question, question_date: q.question_date, answer: q.answer,
      answer_session_ids: q.answer_session_ids, ingest: { sessions: q.haystack_session_ids.length, chunks: chunks.length, memories: memToRound.size, dedup_confirmed: confirmed, replaced, sample_created_at: sampleDates, first_session_date: q.haystack_dates[0] },
      recall: { evidence: ev.evidence, cosine: ev.cosine, lexical: ev.lexical, gate_abstained: ev.abstained,
        top: ranked.slice(0, cfg.k).map((m) => ({ id: m.id, round: memToRound.get(m.id), created_at: m.createdAt, score: m.score, gold: answerRounds.includes(memToRound.get(m.id) ?? ""), text: m.text.slice(0, 300) })) },
      answer_calls: answerCalls, hypothesis, cited: ask.cited, abstained_by: abstainedBy,
      judge: { model: cfg.judge_model, prompt, raw: jr.text, label, tokens_in: jr.tokensIn, tokens_out: jr.tokensOut, finish: jr.finishReason },
    };
    writeFileSync(join(RD, "traces", `${q.question_id}.json`), JSON.stringify(trace, null, 2));
    return {
      question_id: q.question_id, question_type: q.question_type, is_abs: isAbs, split: devIds.has(q.question_id) ? "dev" : "heldout",
      n_sessions: q.haystack_session_ids.length, n_chunks: chunks.length, n_memories: memToRound.size, dedup_confirmed: confirmed, replaced,
      answer_session_ids: q.answer_session_ids, retrieved_round_ids: retrievedTop, retrieved_session_ids: [...new Set(retrievedTop.map((r) => r.split("_").slice(0, -1).join("_")))],
      retrieved_scores: ranked.slice(0, cfg.k).map((m) => m.score), evidence: ev.evidence, gate_abstained: ev.abstained,
      retrieval, hypothesis, abstained: !!ask.abstained, abstained_by: abstainedBy, label,
      judge_raw: jr.text.slice(0, 200), answer_tokens_in: answerCalls.reduce((s, c) => s + (c.tokens_in ?? 0), 0), answer_tokens_out: answerCalls.reduce((s, c) => s + (c.tokens_out ?? 0), 0),
      answer_truncated: answerCalls.some((c) => c.finish === "length"), truncation_retries: tr.truncations, judge_label_raw: judgeRaw, judge_override: judgeOverride, judge_tokens_in: jr.tokensIn, judge_tokens_out: jr.tokensOut, latency_ms: Object.fromEntries(Object.entries(lat).map(([k, v]) => [k, Math.round(v)])),
      at: new Date().toISOString(),
    };
  } finally {
    await cm.close().catch(() => {}); rmSync(dir, { recursive: true, force: true });
  }
}

// ---------- main ----------
const todo = qs.filter((q) => !done.has(q.question_id));
run.setTotal(qs.length); if (done.size) run.tick("skipped", qs.length - todo.length);
let status: "completed" | "stopped" | "failed" = "completed";
try {
  // 1) embeddings first (estimate, then spend)
  const texts = todo.flatMap((q) => qChunks(q).map((c) => c.text)).concat(todo.map((q) => q.question));
  const miss = [...new Set(texts)].filter((t) => !cached(t));
  const est = Math.round(miss.reduce((s, t) => s + t.length, 0) / 4);
  const estUsd = est * (cfg.prices.tokens?.[cfg.embed_model]?.in ?? 0) / 1e6;
  run.event("embed.estimate", { missing_texts: miss.length, est_tokens: est, est_usd: estUsd });
  console.error(`[${phase}] embeddings: ${miss.length} uncached texts, ~${est} tokens, ~$${estUsd.toFixed(4)}`);
  const embedProvider = cfg.embed_model.split(":")[0]!;
  if (estUsd > (budgets.maxUsdByProvider[embedProvider] ?? Infinity)) throw new BudgetExceededError(`embedding estimate $${estUsd.toFixed(3)} exceeds remaining ${embedProvider} budget`);
  await embedMissing(texts, phase);

  // 2) questions
  let next = 0;
  await Promise.all(Array.from({ length: cfg.concurrency.questions }, async () => {
    while (next < todo.length && !run.stopped) {
      const q = todo[next++]!;
      try {
        run.checkBudget();
        const rec = await run.trace(q.question_id, () => evalQuestion(q), { question_type: q.question_type });
        appendFileSync(recFile, JSON.stringify(rec) + "\n"); run.tick("ok");
        const p = run.progress();
        console.error(`[${phase}] ${p.done}/${p.total} ${q.question_id} ${rec.label ? "CORRECT" : "wrong"} ${rec.abstained ? `(abstained:${rec.abstained_by})` : ""} cost=$${p.cost_usd.toFixed(3)} eta=${p.eta_sec ?? "?"}s`);
      } catch (e) {
        if (e instanceof BudgetExceededError) { console.error(`[${phase}] STOP: ${e.message}`); break; }
        const ftype = (e as Error)?.name === "TruncatedFinal" ? "truncated" : "error"; appendFileSync(join(RD, "failures.jsonl"), JSON.stringify({ question_id: q.question_id, question_type: q.question_type, kind: ftype, error: String((e as Error)?.message ?? e).slice(0, 300), at: new Date().toISOString() }) + "\n"); run.tick("failed"); run.event("question.error", { question_id: q.question_id, kind: ftype, error: String((e as Error)?.message ?? e).slice(0, 500) });
        console.error(`[${phase}] ERROR ${q.question_id}: ${String((e as Error)?.message ?? e).slice(0, 200)}`);
      }
    }
  }));
  if (run.stopped) status = "stopped";
} catch (e) {
  if (e instanceof BudgetExceededError) { status = "stopped"; run.stop(e.message); } else { status = "failed"; run.event("phase.error", { error: String((e as Error)?.message ?? e) }); console.error(e); }
} finally {
  const tot = run.finish(status);
  console.error(`[${phase}] ${status}. cost $${tot.usd.toFixed(4)} (tokens $${tot.tokenUsd.toFixed(4)}, gpu est $${tot.gpuUsd.toFixed(4)}), elapsed ${tot.elapsedSec.toFixed(0)}s`);
}
