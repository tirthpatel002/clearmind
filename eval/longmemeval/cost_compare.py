#!/usr/bin/env python3
"""Cost/time vs other providers from MEASURED tokens + PUBLISHED prices. usage: cost_compare.py <phase_dir> <dataset_size.json> <out.md>"""
import json, sys, glob, statistics as st
PD, DS, OUT = sys.argv[1:4]
R = [json.loads(l) for l in open(f"{PD}/records.jsonl")]
ev = [json.loads(l) for f in sorted(glob.glob(f"{PD}/events/*.jsonl")) for l in open(f)]
ds = json.load(open(DS)); N = 500; CONC = 16
m = lambda k: st.mean((r.get(k) or 0) for r in R)
a_in, a_out, j_in, j_out = m("answer_tokens_in"), m("answer_tokens_out"), m("judge_tokens_in"), m("judge_tokens_out")
vis = st.mean(len(r.get("hypothesis") or "") / 4 for r in R)  # visible answer tokens (chars/4)
emb = [e for e in ev if e["kind"] == "embed"]; etok = sum(e["tokens_in"] or 0 for e in emb); ecost = sum(e["cost_usd"] or 0 for e in emb)
ntexts = sum(e["attrs"].get("n_messages") or 0 for e in emb)
emb_tok_500 = etok * N / len(R) if emb else ds["all500"]["unique_tokens"]
D = "2026-10-29"
AA = lambda s: f"https://artificialanalysis.ai/models/{s}"
# provider, model, in $/M, out $/M, TTFT s, tok/s, reasoning?, price src, speed src, note
P = [
 ("OpenAI", "GPT-4o", 2.50, 10.00, 1.04, 163.4, False, "https://platform.openai.com/docs/pricing", AA("gpt-4o"), "paper/Zep reference model"),
 ("OpenAI", "GPT-4o mini", 0.15, 0.60, 0.97, 104.6, False, "https://platform.openai.com/docs/pricing", AA("gpt-4o-mini"), ""),
 ("Anthropic", "Claude 4.5 Sonnet (non-reasoning)", 3.00, 15.00, 1.03, 46.7, False, AA("claude-4-5-sonnet"), AA("claude-4-5-sonnet"), "price via Artificial Analysis"),
 ("Anthropic", "Claude 4.5 Haiku (non-reasoning)", 1.00, 5.00, 0.47, 84.6, False, AA("claude-4-5-haiku"), AA("claude-4-5-haiku"), "price via Artificial Analysis"),
 ("Anthropic", "Claude Haiku 5.5 (max, reasoning)", 0.10, 0.50, None, 240.0, True, AA("claude-haiku-5-5"), AA("claude-haiku-5-5"), "AA time-to-first-answer 341 s at max effort; time uses our measured reasoning tokens instead"),
 ("Google", "Gemini 2.5 Flash (non-reasoning)", 0.30, 2.50, 0.38, 204.4, False, AA("gemini-2-5-flash"), AA("gemini-2-5-flash"), "price via Artificial Analysis"),
 ("Google", "Gemini 3.8 Flash (high, reasoning)", 0.75, 3.75, None, 137.4, True, AA("gemini-3-8-flash"), AA("gemini-3-8-flash"), "price via Artificial Analysis"),
 ("Nebius Token Factory", "Nemotron-3-Ultra-550b-a55b", 1.00, 3.00, None, None, True, "https://nebius.com/services/token-factory/models/nvidia-nemotron-models-inference", None, "no published speed found; cost only"),
 ("Nebius Token Factory", "Qwen3 30B A3B 2507 Instruct", 0.10, 0.30, 0.93, 198.2, False, AA("qwen3-30b-a3b-2507") + "/providers", AA("qwen3-30b-a3b-2507") + "/providers", "smaller Nebius model, ~Glimmer size"),
 ("Groq", "gpt-oss-20b (high)", 0.075, 0.30, 3.10, 840.9, True, "https://console.groq.com/docs/models", AA("gpt-oss-20b") + "/providers", "~20B open model; AA TTFAT 3.1 s includes thinking"),
 ("Together AI", "Muse Spark Open (xhigh)", 1.25, 4.25, 13.91, 151.0, True, AA("muse-spark-open") + "/providers", AA("muse-spark-open") + "/providers", "AA TTFAT includes thinking"),
 ("Fireworks", "Muse Spark Open (xhigh)", 1.25, 4.25, None, None, True, AA("muse-spark-open") + "/providers", None, "speed not in AA top-3; cost only"),
 ("Baseten", "Muse Spark Open (xhigh)", 1.25, 4.25, 8.45, 244.2, True, AA("muse-spark-open") + "/providers", AA("muse-spark-open") + "/providers", "estimate only (we do not use Baseten)"),
]
o = []; H = o.append
H("## Cost and time vs other providers (estimates from published figures, not measured)\n")
H(f"Inputs measured in this run ({len(R)} held-out questions, scaled to the 500-question run): answer prompt **{a_in:.0f}** tokens in / **{a_out:.0f}** out (Glimmer, incl. hidden reasoning; visible answer ≈ {vis:.0f}), judge **{j_in:.0f}** in / **{j_out:.0f}** out per question. "
  f"Embedding: {etok:,} tokens for {ntexts:,} texts in this phase (${ecost:.3f} on Nebius) → ≈ {emb_tok_500/1e6:.1f}M tokens for 500 questions. Concurrency for wall-time estimates: {CONC} questions in parallel, ignoring provider rate limits. "
  f"Non-reasoning models are costed with visible-answer output (~{vis:.0f} answer / 5 judge tokens); reasoning models with our measured Glimmer output counts as a proxy. Prices and speeds fetched {D}.\n")
rows = []
for prov, model, pi, po, ttft, tps, reas, ps, ss, note in P:
    ao, jo = (a_out, j_out) if reas else (vis, 5)
    perq = (a_in + j_in) * pi / 1e6 + (ao + jo) * po / 1e6
    if tps:
        t = 2 * (ttft or 0) + (ao + jo) / tps if ttft is not None and not reas else (ao + jo) / tps + (1.0 if ttft is None else 0)
        if reas and ttft is not None: t = 2 * 0.5 + (ao + jo) / tps
        ts, wall = f"{t:.1f} s", f"{N * t / CONC / 60:.0f} min"
    else: ts = wall = "n/a"
    src = f"[price]({ps})" + (f", [speed]({ss})" if ss and ss != ps else (", speed same" if ss else ""))
    rows.append([prov, model, f"${perq*N:.2f}", f"${perq:.4f}", ts, wall, f"{note} {src}".strip()])
glim = [e for e in ev if e["kind"] == "chat"]
H("| provider | model (answer + judge) | $ full 500-q run | $ / question | est. time / question | est. wall @16 | notes / sources |")
H("|---|---|---|---|---|---|---|")
for r in rows: H("| " + " | ".join(r) + " |")
H("")
H("Time/question = answer + judge generation: non-reasoning models 2×TTFT + output/(tok/s); reasoning models 2×0.5 s + measured output/(tok/s). Excludes Clearmind recall (~50 ms) and embedding. **Our measured Glimmer/Modal numbers are in the Cost and time section above** (GPU-time estimate, $2.50/GPU-h).\n")
H("### Embedding cost for the 500-question benchmark (one-off setup)\n")
E = [("Nebius", "Qwen3-Embedding-8B (used)", 0.01, "https://tokenfactory.nebius.com/model-catalog.md"), ("OpenAI", "text-embedding-3-small", 0.02, "https://platform.openai.com/docs/pricing"),
     ("OpenAI", "text-embedding-3-large", 0.13, "https://platform.openai.com/docs/pricing"), ("Voyage", "voyage-4-lite", 0.02, "https://docs.voyageai.com/docs/pricing"),
     ("Voyage", "voyage-4", 0.06, "https://docs.voyageai.com/docs/pricing"), ("Voyage", "voyage-4-large", 0.12, "https://docs.voyageai.com/docs/pricing")]
H("| provider | model | $/M tokens | $ for ≈{:.1f}M tokens | $ per million memories (~{:.0f} tok each) | source |".format(emb_tok_500/1e6, etok/max(1,ntexts) if ntexts else 480))
H("|---|---|---|---|---|---|")
pm = etok / max(1, ntexts) if ntexts else 480
for prov, mo, p, s in E: H(f"| {prov} | {mo} | ${p} | ${emb_tok_500*p/1e6:.2f} | ${pm*p:.2f} | [link]({s}) |")
H("\nVoyage gives the first 200M tokens free per account (same page). Nebius price is the rate configured in the harness ($0.01/M), consistent with the run's metered cost.\n")
H("### Full-context baseline vs Clearmind retrieval (token savings)\n")
fc = ds["all500"]["mean_tokens"]
H(f"The paper's full-context setup feeds the whole history to the reader. Measured mean haystack = **{fc:,.0f} tokens/question** (o200k tokenizer; Zep reports ~115k with its prompt overhead). Clearmind's answer prompt = **{a_in:,.0f} tokens** (top-20 memories), i.e. **{fc/a_in:.0f}× fewer input tokens ({100*(1-a_in/fc):.1f}% saved)**.\n")
H("| reader | full-context $/question | Clearmind $/question | full-context $ / 500 q | Clearmind $ / 500 q |")
H("|---|---|---|---|---|")
for name, pi, po in [("GPT-4o", 2.50, 10.0), ("GPT-4o mini", 0.15, 0.60), ("Nemotron Ultra (Nebius)", 1.00, 3.00)]:
    f = fc * pi / 1e6 + vis * po / 1e6; c = a_in * pi / 1e6 + vis * po / 1e6
    H(f"| {name} | ${f:.4f} | ${c:.4f} | ${f*N:.2f} | ${c*N:.2f} |")
H("\nAnswer call only (no judge); Clearmind additionally pays once per memory for embedding (table above) at write time. Published full-context latency for GPT-4o on LongMemEval-S: 28.9 s vs 2.58 s with Zep's ~1.6k-token context ([Zep, Table 2](https://arxiv.org/html/2501.13956)).\n")
open(OUT, "w").write("\n".join(o)); print("wrote", OUT)
