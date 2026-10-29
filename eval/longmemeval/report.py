#!/usr/bin/env python3
"""Pilot report for the Clearmind LongMemEval-S eval. Reads phase dirs under the run root and writes REPORT.md + REPORT.html."""
import json, sys, os, html, statistics as st
ROOT = sys.argv[1]; PH = ["pilot", "pilot-r2"]
def jl(p): return [json.loads(l) for l in open(p)] if os.path.exists(p) else []
recs = {}
for ph in PH:
    for r in jl(f"{ROOT}/{ph}/records.jsonl"): r["_phase"] = ph; recs[r["question_id"]] = r  # r2 supersedes failed first-pass ids
R = list(recs.values()); man = {ph: json.load(open(f"{ROOT}/{ph}/manifest.json")) for ph in PH}
cfg = json.load(open(f"{ROOT}/pilot-r2/config.used.json")); tun = json.load(open(f"{ROOT}/tuning.json"))
dev = json.load(open(f"{ROOT}/dev_ids.json")); overlap = json.load(open(f"{ROOT}/subset_overlap_heldout.json"))
first_fail = [l.split()[2].rstrip(":") for l in open("/tmp/pilot.out") if l.startswith("[pilot] ERROR")] if os.path.exists("/tmp/pilot.out") else []
pct = lambda a, b: f"{100*a/b:.1f}% ({a}/{b})" if b else "n/a"
out = []; H = out.append
def table(head, rows): H("| " + " | ".join(head) + " |"); H("|" + "---|" * len(head)); [H("| " + " | ".join(str(c) for c in r) + " |") for r in rows]; H("")
ans = [r for r in R if not r["is_abs"]]; ab = [r for r in R if r["is_abs"]]
H("# Clearmind on LongMemEval-S: 50-question dev pilot (Modal / muse-glimmer-30b)\n")
H(f"> **Non-standard judge.** Answers AND grading use `muse-glimmer-30b`; the official LongMemEval judge is `gpt-4o-2024-08-06`. "
  f"**Small sample**: n=50 dev questions (the tuning split), so these are *dev* numbers, not a held-out score; 95% CI on accuracy is roughly ±13 pts. The full 500 / held-out 450 was **not run** (stopped by request after the pilot).\n")
H("## 1. Summary\n")
acc = sum(r["label"] for r in R)
table(["metric", "value"], [["QA accuracy (all 50)", pct(acc, len(R))],
  ["answerable accuracy", pct(sum(r["label"] for r in ans), len(ans))],
  ["abstention accuracy (_abs, judge)", pct(sum(r["label"] for r in ab), len(ab))],
  ["_abs questions where Clearmind abstained", pct(sum(r["abstained"] for r in ab), len(ab))],
  ["false-abstention rate (answerable declined)", pct(sum(r["abstained"] for r in ans), len(ans))],
  ["  of which evidence gate / model", f"{sum(r['abstained_by']=='evidence-gate' for r in ans)} / {sum(r['abstained_by']=='model' for r in ans)}"],
  ["truncations (first pass, max_tokens 2048/512)", f"{len(first_fail)}/50 questions failed (empty text at max_tokens): {', '.join(first_fail)}"],
  ["truncations after fix (4096/1024 + one retry at 8192/4096)", f"{sum(bool(r.get('truncation_retries')) for r in R if r['_phase']=='pilot-r2')} retried, 0 final failures; all 8 re-run in phase pilot-r2"],
  ["questions scored", f"{len(R)}/50 (0 failed after re-run)"]])
H("## 2. Accuracy by question type\n")
types = sorted({r["question_type"] for r in R}); rows = []
for t in types:
    g = [r for r in R if r["question_type"] == t]; ga = [r for r in g if not r["is_abs"]]
    rows.append([t, len(g), pct(sum(r["label"] for r in g), len(g)), sum(r["is_abs"] for r in g), pct(sum(r["abstained"] for r in ga), len(ga))])
table(["type", "n", "accuracy", "_abs", "false-abstain (answerable)"], rows)
H("Dev split is not stratified by type (drawn by the other worker from clearmind-bench v1 LME rows, seed 20261029); per-type n is tiny.\n")
H("## 3. Retrieval (session level, official eval_utils.py method, answerable only, n=%d)\n" % len(ans))
sysn = ["clearmind", "bm25", "embedding"]; keys = ["recall_any@5", "recall_all@5", "recall_all@10", "ndcg_any@10", "turn_recall_all@10", "turn_recall_all@50"]
rows = []
for s in sysn:
    v = [r["retrieval"][s] for r in ans if r.get("retrieval", {}).get(s)]
    rows.append([s + (" (hybrid 0.7/0.3 gate; ranking hybrid 0.5/0.5)" if s == "clearmind" else " (no tuning baseline)"), len(v)] + [f"{st.mean(x[k] for x in v):.3f}" for k in keys])
table(["retriever", "n"] + keys, rows)
H("Round = user turn + following assistant turn (long rounds split at 3800 chars). Clearmind ranking = `recall(q, 50)` with minSimilarity **0.3** (bench parity; app default is 0.5). "
  "Baselines rank all rounds of the haystack by pure BM25 / pure Qwen3-Embedding-8B cosine, top-k standard. "
  "Reference (LongMemEval paper, Wu et al. 2024, LongMemEval-S, session-level value, flat retrieval): their best dense retrievers reach recall@5 in the ~0.6–0.7 range and BM25 lower; compare only qualitatively — different chunking, embedder and n.\n")
H("## 4. Published QA scores for context (not comparable: different judge/model/n)\n")
table(["system", "LongMemEval-S QA", "judge"], [["GPT-4o full context (paper)", "≈60.6%", "gpt-4o"], ["Zep (vendor blog, gpt-4o)", "≈71.2%", "gpt-4o"], ["**Clearmind pilot (this run)**", f"{100*acc/len(R):.1f}% (n=50 dev)", "glimmer (non-standard)"]])
H("Published figures are quoted from memory of public sources and were not re-verified in this run.\n")
H("## 5. Cost and time\n")
tot = lambda k: sum(man[p]["totals"][k] for p in PH)
gpu = {p: man[p]["totals"]["gpu"]["glimmer:*"] for p in PH}
table(["item", "pilot", "pilot-r2 (truncation re-run)", "total"], [
  ["wall clock (s)", round(man["pilot"]["totals"]["elapsedSec"]), round(man["pilot-r2"]["totals"]["elapsedSec"]), round(tot("elapsedSec"))],
  ["Modal GPU billed est. (s)", round(gpu["pilot"]["billedSec"]), round(gpu["pilot-r2"]["billedSec"]), round(sum(g["billedSec"] for g in gpu.values()))],
  ["Modal GPU busy (s)", round(gpu["pilot"]["busySec"]), round(gpu["pilot-r2"]["busySec"]), round(sum(g["busySec"] for g in gpu.values()))],
  ["Modal $ (estimate)", f"${gpu['pilot']['usd']:.3f}", f"${gpu['pilot-r2']['usd']:.3f}", f"${sum(g['usd'] for g in gpu.values()):.3f}"],
  ["Nebius embedding $ (tokens × $0.01/M)", f"${man['pilot']['totals']['tokenUsd']:.4f}", f"${man['pilot-r2']['totals']['tokenUsd']:.4f}", f"${tot('tokenUsd'):.4f}"],
  ["Total $", f"${man['pilot']['totals']['usd']:.3f}", f"${man['pilot-r2']['totals']['usd']:.3f}", f"${tot('usd'):.3f}"]])
H("Modal cost basis: **estimate** = union of request intervals + 300 s scale-down tail × $2.50/h (A100-80GB); actual Modal billing was not retrievable from the VM. "
  "Excludes smoke (10 q, $0.26) and the cap test ($0.22). Throughput reached ≈13 q/min in smoke with warm caches at concurrency 8.\n")
rows = []
for p in PH:
    for k, v in man[p]["totals"]["byStage"].items(): rows.append([p, k, v["count"], v["errors"], f"{v['ms']/1000:.0f}", f"{v['ms']/max(v['count'],1)/1000:.1f}"])
table(["phase", "stage", "count", "errors", "total s (summed over concurrent workers)", "mean s"], rows)
lat = {k: st.median(r["latency_ms"].get(k, 0) for r in R)/1000 for k in ["ingest_ms", "recall_ms", "answer_ms", "judge_ms"]}
H("Median per-question latency (s): " + ", ".join(f"{k[:-3]} {v:.1f}" for k, v in lat.items()) + "\n")
gtok = sum(man[p]["totals"]["byProvider"]["glimmer"]["tokensOut"] for p in PH)
H(f"Glimmer tokens: in {sum(man[p]['totals']['byProvider']['glimmer']['tokensIn'] for p in PH):,}, out {gtok:,}. Nebius: {sum(man[p]['totals']['byProvider'].get('nebius',{}).get('tokensIn',0) for p in PH):,} embedding tokens; 4 rate-limit retries + 1 hard 429 failure on the first launch (fixed with a 540k tok/min pacer + backoff).\n")
H("### Extrapolation to the full 500\n")
qa_s = (man["pilot"]["totals"]["elapsedSec"] - 175) / 50
H(f"- Embeddings: ~96k unique rounds ≈ 47M tokens ≈ **$0.47** Nebius; at the 600k tok/min quota (paced 540k) ≈ **~90 min** if done up front (GPU idle/scaled to zero during it).\n"
  f"- QA: ≈{qa_s:.0f} s/question wall at concurrency 8 → 500 q ≈ **{500*qa_s/3600:.1f} h**, Modal ≈ **${500*qa_s/3600*2.5+0.21:.2f}** (estimate; under the 3 h / $7.50 cap). Raising concurrency to 16 likely shortens this.\n"
  f"- Total ≈ **${500*qa_s/3600*2.5+0.21+0.47:.2f}**, ~{(500*qa_s+5400)/3600:.1f} h end to end.\n")
H("## 6. Tuning provenance\n")
table(["parameter", "value", "tuned on"], [
  ["recall.abstain.alpha (evidence = α·cosine + (1−α)·lexical)", "0.7", "dev_ids.json (50) only — tuning.json"],
  ["recall.abstain.minEvidence", "0.35", "dev_ids.json only"],
  ["recall.abstain.minEvidenceLexical", "0.34", "not tuned (offline fallback)"],
  ["NO_MEMORY instruction", "\"I don't have that in memory.\"", "design choice, same on Glimmer"],
  ["hybrid ranking 0.5/0.5 + similarity threshold", "0.5 / minSimilarity 0.3", f"earlier: set B + LongMemEval subset (120 q, memory-bench lme_subset.jsonl); {len(overlap)} of those are outside dev (held-out), 13 are dev"],
  ["k (answer context)", cfg.get("k"), "a priori, not tuned"], ["chunk_max_chars", cfg.get("chunk_max_chars"), "a priori"],
  ["answer/judge max_tokens", "4096 / 1024 (+retry 8192/4096)", "raised after pilot truncations (engineering, not accuracy tuning)"]])
H(f"Because the abstention thresholds were tuned on exactly these 50 questions, the pilot's abstention numbers are optimistic. A future held-out run must report results with and without the {len(overlap)} subset-overlap ids (list in subset_overlap_heldout.json).\n")
H("## 7. Caveats and issues\n")
H("- Judge is Glimmer, not gpt-4o. Example: `ba358f49_abs` — Clearmind answered exactly \"I don't have that in memory.\" yet the judge said 'No' to the abstention rubric (likely misgrade). Official prompt and yes-parsing used verbatim; reasoning is in a separate field, so `max_tokens 10` (official) is impossible with this reasoning model.\n"
  "- Glimmer is a reasoning model: 8/50 questions truncated on the first pass (2 answer, 6 judge calls); they were re-run (phase `pilot-r2`) with the raised limits and are scored; truncations are listed above, not counted as wrong.\n"
  "- Supersession is not exercised by raw-turn ingest (0 replacements); duplicates confirmed counted per question.\n"
  "- The config changed between pilot and pilot-r2 (max_tokens only); each phase has its own config hash in manifest.json.\n"
  "- git trees were dirty (uncommitted harness) at run time; shas: " + ", ".join(f"{k} {v['sha'][:7]}" for k, v in man['pilot']['git'].items()) + ".\n")
H("## 8. Config\n")
H("```json\n" + json.dumps({k: v for k, v in cfg.items() if k not in ("prices",)}, indent=1)[:3500] + "\n```\n")
md = "\n".join(out); open(f"{ROOT}/REPORT.md", "w").write(md)
# minimal md->html
import re
def conv(md):
    o, intab, code = [], False, False
    for l in md.split("\n"):
        if l.startswith("```"): o.append("</pre>" if code else "<pre>"); code = not code; continue
        if code: o.append(html.escape(l)); continue
        e = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", html.escape(l)); e = re.sub(r"`(.+?)`", r"<code>\1</code>", e)
        if l.startswith("|"):
            if "---" in l: continue
            cells = [c.strip() for c in e.strip("|").split("|")]
            if not intab: o.append("<table>"); intab = True; o.append("<tr>" + "".join(f"<th>{c}</th>" for c in cells) + "</tr>"); continue
            o.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"); continue
        if intab: o.append("</table>"); intab = False
        if l.startswith("#"): n = len(l) - len(l.lstrip("#")); o.append(f"<h{n}>{e[n:].strip()}</h{n}>")
        elif l.startswith("&gt; "): o.append(f"<blockquote>{e[5:]}</blockquote>")
        elif l.startswith("- "): o.append(f"<li>{e[2:]}</li>")
        elif l.strip(): o.append(f"<p>{e}</p>")
    return "\n".join(o)
css = "body{font:14px/1.5 system-ui;max-width:1100px;margin:2em auto;padding:0 1em}table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f3f3f3}blockquote{background:#fff6e0;border-left:4px solid #e0a000;padding:.5em 1em}pre{background:#f6f6f6;padding:1em;overflow:auto}"
open(f"{ROOT}/REPORT.html", "w").write(f"<!doctype html><meta charset=utf-8><title>Clearmind LME pilot</title><style>{css}</style>{conv(md)}")
print(md)
