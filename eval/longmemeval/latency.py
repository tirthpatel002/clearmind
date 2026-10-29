#!/usr/bin/env python3
"""Latency/observability section from hackkit spans. usage: latency.py <phase_dir> <haystack_sizes.json> <out.md>"""
import json, sys, glob, os, statistics as st
PD, HS, OUT = sys.argv[1:4]
ev = [json.loads(l) for f in sorted(glob.glob(f"{PD}/events/*.jsonl")) for l in open(f)]
recs = {r["question_id"]: r for r in (json.loads(l) for l in open(f"{PD}/records.jsonl"))}
hs = json.load(open(HS))
o = []; H = o.append
def q(a, p):
    a = sorted(a); 
    if not a: return float("nan")
    k = (len(a) - 1) * p; f = int(k); c = min(f + 1, len(a) - 1); return a[f] + (a[c] - a[f]) * (k - f)
def row(name, a, tot=None):
    s = [x / 1000 for x in a]
    return [name, len(s)] + [f"{v:.2f}" for v in (q(s,.5), q(s,.9), q(s,.95), q(s,.99), max(s), st.mean(s))] + ([f"{100*sum(a)/tot:.1f}%"] if tot else [])
def table(h, rows): H("| " + " | ".join(h) + " |"); H("|" + "---|" * len(h)); [H("| " + " | ".join(str(c) for c in r) + " |") for r in rows]; H("")
stages = {}
for e in ev:
    if e["kind"] == "stage" and e["trace_id"] in recs: stages.setdefault(e["name"], {})[e["trace_id"]] = e["latency_ms"]
chat = {"answer": [], "judge": []}
for e in ev:
    if e["kind"] == "chat" and e["stage"] in chat and e["trace_id"] in recs: chat[e["stage"]].append(e)
t_first = min((e["start_ms"] for e in ev if e["kind"] == "stage" and e["name"] == "answer"), default=0)
starts = {e["trace_id"]: e["start_ms"] for e in ev if e["kind"] == "stage" and e["name"] == "answer"}
emb = [e for e in ev if e["kind"] == "embed"]
names = [n for n in ("ingest", "recall", "baselines", "answer", "judge") if n in stages]
tot = sum(sum(stages[n].values()) for n in names)
H("## Latency and observability (from hackkit spans)\n")
H(f"Source: `{PD}/events/*.jsonl` ({len(ev)} spans/events) joined to `records.jsonl` ({len(recs)} questions). Stage spans are wall time per question; questions ran concurrently, so per-stage sums are summed question-seconds, not elapsed wall clock. Share = stage's share of summed per-question stage time.\n")
H("### Per-stage latency (seconds)\n")
table(["stage", "n", "p50", "p90", "p95", "p99", "max", "mean", "share"], [row(n, list(stages[n].values()), tot) for n in names])
H("What each stage is: **ingest** = Clearmind write path for the whole haystack (chunk, dedup, store; embeddings already fetched and served from cache, see setup below). **recall** = Clearmind retrieval + evidence gate. **baselines** = untuned BM25/embedding rankers (eval-only). **answer** = Glimmer answer call(s) incl. waiting for a harness concurrency slot. **judge** = Glimmer judge call (eval-only).\n")
# queue vs generation
H("### Model time: queue/wait vs generation\n")
rows = []; decode = {}
for k, cs in chat.items():
    ok = [c for c in cs if c["status"] == "ok" and (c["tokens_out"] or 0) > 20]
    if not ok: continue
    spt = sorted(c["latency_ms"] / c["tokens_out"] for c in ok)
    best = q(spt, .05)  # least-contended 5% of calls ~ uncontended ms/token incl. prefill
    decode[k] = best
    gen = [min(c["latency_ms"], c["tokens_out"] * best) for c in ok]
    wait = [c["latency_ms"] - g for c, g in zip(ok, gen)]
    stg = sum(stages.get(k, {}).values()); cl = sum(c["latency_ms"] for c in cs)
    tin = [c["tokens_in"] or 0 for c in ok]; tout = [c["tokens_out"] for c in ok]
    tps = [c["tokens_out"] / (c["latency_ms"] / 1000) for c in ok]
    rows.append([k, len(cs), f"{st.mean(tin):.0f} / {q(tin,.5):.0f}", f"{st.mean(tout):.0f} / {q(tout,.5):.0f}", f"{q(tps,.5):.1f}", f"{1000/best:.1f}",
                 f"{q([g/1000 for g in gen],.5):.1f}", f"{q([w/1000 for w in wait],.5):.1f}", f"{100*sum(wait)/cl:.0f}%", f"{max(0,stg-cl)/1000/max(1,len(stages.get(k,{}))):.1f}"])
table(["call", "calls", "tokens in mean/p50", "tokens out mean/p50", "observed tok/s p50", "uncontended tok/s (est.)", "generation p50 s (est.)", "queue/wait p50 s (est.)", "wait share of call time", "harness slot wait, mean s/question"], rows)
H("How queue vs generation is split: Glimmer calls are non-streaming, so time-to-first-token is not observable. Uncontended speed is estimated as the 5th-percentile ms per output token across all calls (the least-loaded calls; includes prefill). Generation ≈ tokens_out × that rate; the remainder of each call is attributed to server-side queueing/batching contention on the single Modal container. 'Harness slot wait' is stage time outside the HTTP call (waiting for one of the 24 concurrent model-call slots). Output tokens include Glimmer's hidden reasoning tokens.\n")
# haystack size
H("### Latency vs haystack size\n")
rows = []
qs = [k for k in recs if k in hs]
qt = sorted(hs[k]['tokens'] for k in qs); cuts = [0] + [q(qt, p) for p in (.25, .5, .75)] + [1e9]
for lo, hi in zip(cuts, cuts[1:]):
    b = [k for k in qs if lo <= hs[k]["tokens"] < hi]
    if not b: continue
    g = lambda n: [stages[n][k] / 1000 for k in b if k in stages.get(n, {})]
    rows.append([f"{lo/1e3:.1f}k–{'max' if hi>1e8 else f'{hi/1e3:.1f}k'}", len(b), f"{st.mean(hs[k]['sessions'] for k in b):.1f}", f"{st.mean(hs[k]['messages'] for k in b):.0f}",
                 f"{q(g('ingest'),.5):.1f}", f"{q(g('recall'),.5):.2f}", f"{q(g('answer'),.5):.1f}", f"{st.mean((recs[k].get('answer_tokens_in') or 0) for k in b):.0f}"])
table(["haystack tokens", "questions", "mean sessions", "mean messages", "ingest p50 s", "recall p50 s", "answer p50 s", "answer prompt tokens (mean)"], rows)
def corr(x, y):
    mx, my = st.mean(x), st.mean(y); sx = sum((a-mx)**2 for a in x)**.5; sy = sum((b-my)**2 for b in y)**.5
    return sum((a-mx)*(b-my) for a, b in zip(x, y)) / (sx*sy) if sx and sy else float("nan")
for n in ("ingest", "recall", "answer"):
    ks = [k for k in qs if k in stages.get(n, {})]
    H(f"- Pearson r, haystack tokens vs {n} time: {corr([hs[k]['tokens'] for k in ks], [stages[n][k] for k in ks]):.2f}; messages vs {n}: {corr([hs[k]['messages'] for k in ks], [stages[n][k] for k in ks]):.2f}")
H("\nNo meaningful correlation: LongMemEval-S haystacks are nearly uniform (~100k tokens, ~48 sessions), so this benchmark cannot show scaling. Recall cost is bounded by top-k and the answer prompt is capped at k=20 memories regardless of haystack size; ingest cost grows linearly with memory count (per-memory cost below).\n")
# slowest
H("### Slowest 10 questions (end-to-end per-question wall time)\n")
e2e = {k: sum(stages[n].get(k, 0) for n in names) for k in recs}
rows = []
for k in sorted(e2e, key=e2e.get, reverse=True)[:10]:
    parts = {n: stages[n].get(k, 0) for n in names}; dom = max(parts, key=parts.get)
    r = recs[k]; why = f"{dom} {parts[dom]/1000:.0f}s"
    if r.get("truncation_retries"): why += "; truncation retry (" + ",".join(map(str, r["truncation_retries"])) + ")"
    if dom in ("answer","judge") and parts[dom] > 180000 and starts.get(k, 1e18) - t_first < 900000: why += "; includes Modal cold start / startup queue"
    if dom in ("answer", "judge"): why += f"; out {r.get(dom+'_tokens_out')} tok (reasoning)"
    if dom == "ingest": why += f"; {hs.get(k,{}).get('messages')} messages"
    rows.append([k, r["question_type"], f"{e2e[k]/1000:.0f}", why])
table(["question", "type", "total s", "why (dominant stage)"], rows)
# clearmind overhead
H("### Clearmind's own overhead vs model time\n")
cm = [stages["recall"][k] for k in recs if k in stages.get("recall", {})]
mt = [stages["answer"][k] for k in recs if k in stages.get("answer", {})]
H(f"- Clearmind read path (recall + evidence gate): p50 {q(cm,.5):.0f} ms, p95 {q(cm,.95):.0f} ms, max {max(cm):.0f} ms. This includes the query embedding (served from the pre-fetched cache in this benchmark; a live query embed adds one embedding round-trip in production).")
H(f"- Answer model (Glimmer, shared GPU under load): p50 {q(mt,.5)/1000:.1f} s, p95 {q(mt,.95)/1000:.1f} s. Clearmind is {100*st.median(cm)/st.median(mt):.2f}% of median answer-path time.")
ing = [(stages["ingest"][k], recs[k]["n_memories"] or 1, recs[k]["n_chunks"] or 1) for k in recs if k in stages.get("ingest", {})]
pm = [a / b for a, b, _ in ing]
H(f"- Write path per memory (chunk + dedup + store, embedding served from cache): p50 {q(pm,.5):.1f} ms, p95 {q(pm,.95):.1f} ms per memory (mean {st.mean(b for _,b,_ in ing):.0f} memories per haystack).")
if emb:
    pt = [e["latency_ms"] / max(1, e["attrs"].get("n_messages") or 1) for e in emb if e["status"] == "ok"]
    toks = sum(e["tokens_in"] or 0 for e in emb); n = sum(e["attrs"].get("n_messages") or 0 for e in emb); c = sum(e["cost_usd"] or 0 for e in emb)
    bl = [e["latency_ms"] for e in emb if e["status"] == "ok"]
    H(f"- Embedding (Nebius Qwen3-Embedding-8B), from this run's {len(emb)} batched calls: {n} texts, {toks/max(1,n):.0f} tokens and ${c/max(1,n)*1e6:.2f} per million memories → ${c/max(1,n):.7f} per memory; batch call latency p50 {q(bl,.5)/1000:.1f} s for ~64 texts (amortised {q(pt,.5):.0f} ms/text). A single-memory embed in production is one round-trip; it was not measured live (no new Nebius calls were allowed).")
H("")
H("### One-off benchmark setup vs production behaviour\n")
H("- **Benchmark setup (one-off, not production):** LongMemEval gives each question a fresh ~100k-token haystack, so the harness had to embed every haystack message at question time (here pre-fetched in one paced batch stage, rate-limited to 540k tokens/min by the Nebius quota) and then re-ingest ~50 sessions per question. That embedding stage and the ingest stage are the bulk of wall-clock time and are **not** what a user waits for.")
H("- **Production:** memories are embedded and written once, at write time, in the background (cost per memory above). A question then costs: one query embedding + Clearmind recall/gate + one answer call over ~top-20 memories (≈ the answer prompt tokens above). No judge call.\n")
H("### Estimated production per-question latency with a fast hosted model\n")
p50r = q(cm, .5) / 1000; pin = st.mean((recs[k].get('answer_tokens_in') or 0) for k in recs)
for name, ttft, tps, src in [("GPT-4o (Nov '24)", 1.04, 163.4, "https://artificialanalysis.ai/models/gpt-4o"), ("GPT-4o mini", 0.97, 104.6, "https://artificialanalysis.ai/models/gpt-4o-mini")]:
    est = 0.3 + p50r + ttft + 120 / tps
    H(f"- {name}: published TTFT {ttft:.2f} s and {tps} output tok/s ([Artificial Analysis]({src}), fetched 2026-10-29; their default ~10k-token-input workload, larger than our ~{pin:.0f}-token prompt). Estimate = query embed ~0.3 s (assumed, not measured) + Clearmind recall p50 {p50r:.2f} s + TTFT + 120-token answer → **≈ {est:.1f} s per question**.")
H("- Published reference point: Zep on LongMemEval-S reports **2.58 s** latency (IQR 0.684 s) with gpt-4o and ~1.6k context tokens, versus **28.9 s** for full 115k-token context ([Zep paper, Table 2](https://arxiv.org/html/2501.13956)). These are published, not measured here.")
H("- Our measured Glimmer answer latency is dominated by queueing on one shared Modal GPU at 24-way concurrency and by hidden reasoning tokens; it is a throughput-oriented benchmark setup, not a production latency number.\n")
open(OUT, "w").write("\n".join(o)); print("wrote", OUT)
