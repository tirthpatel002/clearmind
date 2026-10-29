#!/usr/bin/env python3
"""Held-out report for Clearmind on LongMemEval-S. Usage: report_full.py <run root (…/2026-10-29-lme-full)> <pilot root>"""
import json, sys, os, html, re, statistics as st
ROOT, PILOT = sys.argv[1], sys.argv[2]
jl = lambda p: [json.loads(l) for l in open(p)] if os.path.exists(p) else []
J = lambda p: json.load(open(p))
R = jl(f"{ROOT}/heldout/records.jsonl"); man = J(f"{ROOT}/heldout/manifest.json"); prog = J(f"{ROOT}/heldout/progress.json")
fails = jl(f"{ROOT}/heldout/failures.jsonl"); freeze = J(f"{ROOT}/FREEZE.json"); cfg = J(f"{ROOT}/config.frozen.json")
overlap = set(J(f"{PILOT}/subset_overlap_heldout.json"))
out = []; H = out.append
def pct(a, b): return f"{100*a/b:.1f}% ({a}/{b})" if b else "n/a"
def table(head, rows): H("| " + " | ".join(head) + " |"); H("|" + "---|" * len(head)); [H("| " + " | ".join(str(c) for c in r) + " |") for r in rows]; H("")
def block(Rs):
    A = [r for r in Rs if not r["is_abs"]]; B = [r for r in Rs if r["is_abs"]]
    return dict(n=len(Rs), acc=sum(r["label"] for r in Rs), raw=sum(r.get("judge_label_raw", r["label"]) for r in Rs), nA=len(A), accA=sum(r["label"] for r in A),
                nB=len(B), accB=sum(r["label"] for r in B), rawB=sum(r.get("judge_label_raw", r["label"]) for r in B), abstB=sum(r["abstained"] for r in B),
                fa=sum(r["abstained"] for r in A), gate=sum(r["abstained_by"] == "evidence-gate" for r in A))
def rows_for(b): return [["QA accuracy", pct(b["acc"], b["n"])], ["QA accuracy, raw Glimmer verdicts (no exact-abstention rule)", pct(b["raw"], b["n"])],
    ["answerable accuracy", pct(b["accA"], b["nA"])], ["abstention accuracy (_abs)", pct(b["accB"], b["nB"]) + f"; raw judge {b['rawB']}/{b['nB']}; Clearmind abstained {b['abstB']}/{b['nB']}"],
    ["**false-abstention rate** (answerable declined)", pct(b["fa"], b["nA"]) + f" (evidence gate {b['gate']}, model {b['fa']-b['gate']})"]]
total_q = 450; scored = len(R)
H("# Clearmind on LongMemEval-S: held-out evaluation (450 questions, Modal / muse-glimmer-30b)\n")
H("> **Non-standard judge.** Answers and grading both use `muse-glimmer-30b`; the official judge is `gpt-4o-2024-08-06` (paper meta-eval: 97–98% human agreement). "
  "Our numbers are therefore **not directly comparable** to published scores. One deterministic rule is added on top of the official prompts: on `_abs` questions, the exact reply \"I don't have that in memory.\" is graded correct "
  "(Glimmer mis-graded this in the pilot); raw Glimmer verdicts are reported alongside.\n")
H(f"Config frozen before any held-out question was run: `config.frozen.json` sha256 `{freeze['config_sha256'][:16]}…`; clearmind `{freeze['git']['clearmind']['sha'][:7]}`, agentmemory `{freeze['git']['agentmemory']['sha'][:7]}`, hackkit `{freeze['git']['hackkit']['sha'][:7]}` (all clean). Held-out = the 450 ids not in dev_ids.json (no dev leakage: asserted by the harness). Scored {scored}/{total_q}; failures {len(fails)}.\n")
H("## 1. Headline (held-out)\n")
b = block(R); table(["metric", "all held-out"], rows_for(b))
Rx = [r for r in R if r["question_id"] not in overlap]; bx = block(Rx)
H(f"### Excluding the {len(overlap)} held-out ids that were in the earlier 120-question tuning subset (hybrid 0.5/0.5 + threshold were chosen on it)\n")
table(["metric", f"held-out minus overlap (n={len(Rx)})"], rows_for(bx))
H("## 2. By question type (held-out)\n")
rows = []
for t in sorted({r["question_type"] for r in R}):
    g = [r for r in R if r["question_type"] == t]; ga = [r for r in g if not r["is_abs"]]; gb = [r for r in g if r["is_abs"]]
    rows.append([t, len(g), pct(sum(r["label"] for r in g), len(g)), pct(sum(r["label"] for r in ga), len(ga)), pct(sum(r["label"] for r in gb), len(gb)) if gb else "-", pct(sum(r["abstained"] for r in ga), len(ga))])
table(["type", "n", "accuracy", "answerable acc", "_abs acc", "false-abstain"], rows)
H("## 3. Retrieval (held-out, session level, official `eval_utils.py` method; answerable only)\n")
A = [r for r in R if not r["is_abs"]]; keys = ["recall_any@5", "recall_all@5", "ndcg_any@5", "recall_all@10", "ndcg_any@10"]
rows = []
for s, lab in [("clearmind", "Clearmind (hybrid recall)"), ("bm25", "BM25 — untuned baseline"), ("embedding", "Qwen3-Embedding-8B cosine — untuned baseline")]:
    v = [r["retrieval"][s] for r in A if r.get("retrieval", {}).get(s)]
    rows.append([lab, len(v)] + [f"{st.mean(x[k] for x in v):.3f}" for k in keys])
table(["retriever", "n"] + keys, rows)
H("Paper reference ([Wu et al., LongMemEval, Table 9](https://arxiv.org/html/2410.10813), value = session, K = V; recall = recall_all, the paper's printed metric): "
  "BM25 R@5 0.634 / NDCG@5 0.516 / R@10 0.710 / NDCG@10 0.540; Contriever 0.723 / 0.634 / 0.823 / 0.663; Stella V5 1.5B 0.720 / 0.594 / 0.794 / 0.615. "
  "Caveat: Table 9 does not state S vs M (the Section 5 main experiments use LongMemEval M, much larger haystacks), with user-side-only keys; ours index rounds (user+assistant) of LongMemEval S. Compare qualitatively.\n")
H("## 4. Published QA scores (all graded by gpt-4o; ours is not)\n")
table(["system", "LongMemEval-S accuracy", "source"], [
  ["GPT-4o, full history in context", "60.6% (64.0% with Chain-of-Note)", "[LongMemEval paper, Fig. 3b](https://arxiv.org/html/2410.10813)"],
  ["GPT-4o full context (Zep's run)", "60.2%", "[Zep paper, Table 2](https://arxiv.org/abs/2501.13956)"],
  ["Zep + gpt-4o", "71.2%", "[Zep paper, Table 2](https://arxiv.org/abs/2501.13956)"],
  ["EmergenceMem Internal + gpt-4o", "86.0%", "[Emergence AI blog](https://www.emergence.ai/blog/sota-on-longmemeval-with-rag)"],
  ["**Clearmind + muse-glimmer-30b (this run, held-out 450)**", f"**{100*b['acc']/b['n']:.1f}%** (raw judge {100*b['raw']/b['n']:.1f}%)", "Glimmer judge — non-standard"]])
H("Vendor figures are self-reported on all 500 questions; ours is the 450 held-out ids.\n")
H("## 5. Dev set and tuning provenance\n")
dv = [("pilot (frozen pre-fix config)", f"{PILOT}/pilot/records.jsonl", f"{PILOT}/pilot-r2/records.jsonl"), ("dev-v1", f"{ROOT}/dev-tuning/v1/dev-v1/records.jsonl", None), ("dev-v2 (chosen)", f"{ROOT}/dev-tuning/v2/dev-v2/records.jsonl", None)]
rows = []
for name, p, p2 in dv:
    d = {r["question_id"]: r for r in jl(p)}; d.update({r["question_id"]: r for r in (jl(p2) if p2 else [])}); bb = block(list(d.values()))
    rows.append([name, pct(bb["acc"], bb["n"]), pct(bb["accA"], bb["nA"]), f"{bb['accB']}/{bb['nB']} (abstained {bb['abstB']}/{bb['nB']})", pct(bb["fa"], bb["nA"])])
table(["variant (dev, n=50)", "accuracy", "answerable acc", "_abs", "false-abstain"], rows)
H("Variants (all tuned on dev ids only; selection rule: max dev accuracy with `_abs` abstention ≥ 2/3):\n")
H("- **pilot**: original Clearmind ANSWER_PROMPT (\"If the memories do not clearly contain the answer, reply exactly 'I don't have that in memory.' … never guess\"), minEvidence 0.35, k 10. Pilot judge had no exact-abstention rule (would have been 3/3 on _abs).\n"
  "- **dev-v1**: new prompt P2 (use partial/spread evidence, combine/count/compare dates, prefer latest; best answer with stated assumption; abstain only if NO memory is relevant), minEvidence 0.25, k 10.\n"
  "- **dev-v2**: P2, minEvidence 0.25, **k 20** (more context for multi-session aggregation). Chosen.\n"
  "- Not run: gate removal (the gate fired on 0 answerable dev questions at 0.25 and is the only thing catching `88432d0a_abs`, evidence 0.21).\n")
H("Diagnosis of the 12 pilot false abstentions: 3 evidence-gate (evidence 0.29–0.33, all with gold sessions missed at R@10 — gate was right that retrieval was weak), 9 model declines; 6 of those 9 had every gold session in the top-10 (model too conservative), 3 had retrieval misses.\n")
table(["parameter", "value", "tuned on"], [
  ["answer prompt", "P2 (in config.frozen.json `answer.system_prompt`)", "dev ids (v1/v2)"],
  ["recall.abstain.minEvidence", "0.25 (was 0.35)", "dev ids"], ["recall.abstain.alpha", "0.7", "dev ids (tuning.json, other worker)"],
  ["k (answer context)", "20 (was 10)", "dev ids"], ["recall.minSimilarity", "0.3 (app default 0.5)", "bench parity (earlier)"],
  ["hybrid ranking α 0.5 + BM25", "agentmemory b4150e5", f"earlier: set B + 120-q LME subset ({len(overlap)} overlap held-out → section 1 exclusion)"],
  ["answer/judge max_tokens", "4096/1024, retry 8192/4096", "engineering (truncation), not accuracy"],
  ["concurrency", "16 questions / 24 model calls", "throughput only"]])
H("## 6. Cost and time (held-out run)\n")
T = man["totals"]; g = T["gpu"].get("glimmer:*", {})
table(["item", "value"], [["wall clock", f"{T['elapsedSec']/60:.1f} min"], ["Modal GPU billed (estimate)", f"{g.get('billedSec',0)/3600:.2f} h → ${g.get('usd',0):.2f}"],
  ["Modal GPU busy", f"{g.get('busySec',0)/3600:.2f} h"], ["Nebius embeddings", f"{T['byProvider'].get('nebius',{}).get('tokensIn',0):,} tokens → ${T['tokenUsd']:.3f}"],
  ["total", f"${T['usd']:.2f}"], ["throughput", f"{prog.get('rate_per_min')} q/min overall"], ["calls / errors / retries", f"{T['calls']} / {T['errors']} / {T['retries']}"],
  ["truncation retries", f"{sum(bool(r.get('truncation_retries')) for r in R)} questions retried; {sum(1 for f in fails if f['kind']=='truncated')} final truncation failures"],
  ["stop reason", prog.get("stop_reason") or "none (completed)"]])
rows = [[k, v["count"], v["errors"], f"{v['ms']/1000/60:.1f}", f"{v['ms']/max(v['count'],1)/1000:.1f}"] for k, v in T["byStage"].items()]
table(["stage", "count", "errors", "summed minutes (concurrent)", "mean s"], rows)
lat = {k: st.median(r["latency_ms"].get(k, 0) for r in R)/1000 for k in ["ingest_ms", "recall_ms", "answer_ms", "judge_ms"]}
H("Median per-question latency (s): " + ", ".join(f"{k[:-3]} {v:.1f}" for k, v in lat.items()) + "\n")
dt = 0.0
for p in [f"{ROOT}/dev-tuning/v1/dev-v1", f"{ROOT}/dev-tuning/v2/dev-v2"]: dt += J(p + "/manifest.json")["totals"]["usd"]
H(f"Dev tuning (v1+v2, run concurrently on one container): ${dt:.2f} by per-run estimate (over-counts: both runs bill the same GPU time; real ≈ half). Pilot phase: ≈$1.53 incl. smoke/cap test. Modal basis everywhere: estimate = union of request intervals + 300 s idle tail × $2.50/h (A100-80GB); actual Modal invoice not retrieved.\n")
if fails:
    H("### Failures\n"); table(["question", "type", "kind", "error"], [[f["question_id"], f["question_type"], f["kind"], f["error"][:120]] for f in fails])
H("## 7. Caveats\n")
H("- Non-standard judge (Glimmer); exact-abstention rule added; raw verdicts reported.\n- Answer model is a 30B open reasoning model, not gpt-4o; vendor comparisons are context only.\n"
  "- Dev split (50) is not type-stratified; held-out contains all single-session-assistant / -preference questions with no dev counterpart, so prompts were never tuned on those types.\n"
  "- Supersession is not exercised by raw-turn ingest (no keyed facts); knowledge-update relies on the prompt's 'prefer the most recent' rule and dates.\n"
  "- Modal costs are estimates.\n")
H("## 8. Frozen config\n"); H("```json\n" + json.dumps({k: v for k, v in cfg.items() if k != "prices"}, indent=1) + "\n```\n")
md = "\n".join(out); open(f"{ROOT}/REPORT.md", "w").write(md)
def conv(md):
    o, intab, code = [], False, False
    for l in md.split("\n"):
        if l.startswith("```"): o.append("</pre>" if code else "<pre>"); code = not code; continue
        if code: o.append(html.escape(l)); continue
        e = html.escape(l); e = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", e); e = re.sub(r"`(.+?)`", r"<code>\1</code>", e); e = re.sub(r"\[(.+?)\]\((https?://[^)]+)\)", r'<a href="\2">\1</a>', e)
        if l.startswith("|"):
            if set(l.replace("|", "")) <= set("-"): continue
            cells = [c.strip() for c in e.strip("|").split("|")]
            if not intab: o.append("<table>"); intab = True; o.append("<tr>" + "".join(f"<th>{c}</th>" for c in cells) + "</tr>"); continue
            o.append("<tr>" + "".join(f"<td>{c}</td>" for c in cells) + "</tr>"); continue
        if intab: o.append("</table>"); intab = False
        if l.startswith("#"): n = len(l) - len(l.lstrip("#")); o.append(f"<h{n}>{e[n:].strip()}</h{n}>")
        elif l.startswith("&gt; "): o.append(f"<blockquote>{e[5:]}</blockquote>")
        elif l.startswith("- "): o.append(f"<li>{e[2:]}</li>")
        elif l.strip(): o.append(f"<p>{e}</p>")
    return "\n".join(o)
css = "body{font:14px/1.5 system-ui;max-width:1150px;margin:2em auto;padding:0 1em}table{border-collapse:collapse;margin:1em 0}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}th{background:#f3f3f3}blockquote{background:#fff6e0;border-left:4px solid #e0a000;padding:.5em 1em}pre{background:#f6f6f6;padding:1em;overflow:auto;font-size:12px}"
open(f"{ROOT}/REPORT.html", "w").write(f"<!doctype html><meta charset=utf-8><title>Clearmind LongMemEval-S held-out</title><style>{css}</style>{conv(md)}")
print(md[:4000])
