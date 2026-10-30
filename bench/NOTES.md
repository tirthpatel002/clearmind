# Benchmark Replay Notes & Verification (Worker C - Round 2 Review Fixes)

**Date:** 2026-10-29  
**Worktree Git Commit SHA:** `2cff2206ac05a97a10538e1b94aa015b7788c390`  
**AgentMemory Main Git Commit SHA:** `10b111656d510b909449918605ba7fd9090a7fec`  
**Baseline Import Path:** `/home/ubuntu/work/projects/agentmemory/dist/index.js`  
**Dataset:** `/home/ubuntu/work/library/datasets/clearmind-bench/v1` (291 evaluated cases with `--per-category 30`: 180 recall, 30 abstention, 81 policy)  
**Evaluator System:** Offline Replay Runner (`bench/run.mts`)  
**Output Directory:** `/home/ubuntu/work/runs/2026-10-29-clearmind-bench/agy-c-check/`  

---

## 1. Round 2 Review Remediation Summary

In response to Review Rejection items, the following structural improvements were implemented in `bench/run.mts`:

1. **Strict Baseline Main Isolation**:
   - Baseline system (`before`) no longer resolves via package links to the `supersession` worktree.
   - It directly imports `AgentMemory` and `SqliteStore` from the canonical main build: `/home/ubuntu/work/projects/agentmemory/dist/index.js`.
   - Clearmind (`after`) continues importing from `../src/index.js`.
   - `results.json` config now records `baseline_path`, `agentmemory_git_sha` (`10b111656d510b909449918605ba7fd9090a7fec`), and `worktree_git_sha` (`2cff2206ac05a97a10538e1b94aa015b7788c390`).

2. **Unbiased Store ID Mapping (Removed `mapTextsToMids`)**:
   - Eliminated text-matching heuristic that preferentially selected gold mids when duplicate texts appeared.
   - At insertion time, recorded the store ID returned by the store (`lessonId` for baseline, `Memory.id` for Clearmind) mapped directly to dataset `mid`.
   - On retrieval, returned memories are mapped back to `mid` strictly via store ID.
   - Applied identical unbiased store-ID mapping across both recall and policy evaluations.

3. **CLI Ergonomics & Diagnostics**:
   - Added optional `--cases <comma_separated_ids>` CLI flag for pinpoint filtering and debugging.
   - Added progress telemetry emitting `[progress] X/Y cases completed (<system>, <retriever>)` to `stderr` every 25 cases and on completion.
   - Added per-case timing instrumentation (`timing_ms` and `duration_ms`) directly into each JSONL row.

---

## 2. Comparative Benchmark Results (`--per-category 30`, BM25)

Evaluation executed across 291 cases (180 recall cases across 6 categories, 30 abstention cases, 81 policy cases across 9 categories) in BM25 retrieval mode ($k=10$):

| Metric Group | Metric | Baseline (Before) | Clearmind (After) | Delta | Direction |
|---|---|---|---|---|---|
| **Recall & Abstention** | **Hit@1** | 75.0% | **85.0%** | **+10.0%** | Higher is better |
| | **MRR@k** | 0.8415 | **0.8919** | **+0.0504** | Higher is better |
| | **Newest Wins** | 60.0% | **93.3%** | **+33.3%** | Higher is better |
| | **Stale Top-1 Rate** | 33.3% | **0.0%** | **-33.3%** | Lower is better (0% ideal) |
| | **Recall@5** | 88.0% | 88.0% | 0.0% | Higher is better |
| | **Abstain Rate** | 0.0% | 0.0% | 0.0% | Higher is better |
| | **False Abstain Rate** | 0.6% | 0.6% | 0.0% | Lower is better |
| **Access Policy** | **Decision Accuracy** | 11.1% | **100.0%** | **+88.9%** | Higher is better |
| | **Leak Rate on Denied** | 100.0% | **0.0%** | **-100.0%** | Lower is better (0% ideal) |
| | **Leak Rate Overall** | 91.4% | **0.0%** | **-91.4%** | Lower is better (0% ideal) |
| | **Allowed Recall** | 100.0% | 100.0% | 0.0% | Higher is better |

---

## 3. Deep Dive: Knowledge Update & Conflict Resolution

### A. Knowledge Update (`knowledge_update`, 30 cases)
In plain AgentMemory (`before`), both outdated and updated facts exist as active memories. Lexical scoring frequently ranks the older memory first:
- **Baseline Hit@1**: 43.3% (fewer than half of queries retrieve the current fact at rank 1)
- **Baseline Stale Top-1 Rate**: **53.3%** of queries return the obsolete fact as top result!
- **Clearmind Hit@1**: **90.0%** (+46.7% improvement)
- **Clearmind Newest Wins**: **100.0%** (gold updated fact consistently outranks or eliminates stale memory)
- **Clearmind Stale Top-1 Rate**: **0.0%** (completely eradicated)

### B. Conflict Resolution (`conflict_resolution`, 30 cases)
- **Baseline Hit@1**: 70.0% $\to$ **Clearmind Hit@1**: **83.3%** (+13.3%)
- **Baseline MRR@k**: 0.7778 $\to$ **Clearmind MRR@k**: **0.8444** (+0.0666)
- **Baseline Newest Wins**: 73.3% $\to$ **Clearmind Newest Wins**: **86.7%** (+13.4%)
- **Baseline Stale Top-1 Rate**: 13.3% $\to$ **Clearmind Stale Top-1 Rate**: **0.0%** (-13.3%)

---

## 4. Deep Dive: Access Policy Enforcement

Across 81 policy cases across 9 categories (`allowed`, `no_purpose`, `wrong_purpose`, `wrong_scope`, `after_revoke`, `after_expiry`, `no_grant`, `cross_user`, `extraction`):
- **Baseline AgentMemory**:
  - Decision accuracy: **11.1%** (agrees only on the 9 expected-allowed cases because it cannot deny).
  - **Leak Rate on Denied**: **100.0%** (72 out of 72 unauthorized queries leaked private/protected memories).
  - Even in `allowed`, baseline leaked out-of-scope memories in **22.2%** of cases due to lack of tag-scoped containment.
- **Clearmind**:
  - **Decision Accuracy**: **100.0%** (81/81 correct decisions).
  - **Leak Rate on Denied**: **0.0%** (0/72 leaks).
  - **Overall Leak Rate**: **0.0%** (0/81 leaks).
  - **Allowed Recall**: **100.0%** (9/9 authorized retrievals succeeded).

---

## 5. Verification Checklist

1. **Unit Fixture Verification**:
   - Re-executed all 4 fixture modes in `bench/fixtures/` (`before-bm25`, `after-bm25`, `before-emb`, `after-emb`).
   - All fixture tests passed with 0 errors; fixture report and JSON outputs refreshed.
2. **Main Dataset Check Run**:
   - Executed BM25 `--per-category 30` run on `/home/ubuntu/work/library/datasets/clearmind-bench/v1`.
   - Results: `/home/ubuntu/work/runs/2026-10-29-clearmind-bench/agy-c-check/results-before-bm25.json`
   - Results: `/home/ubuntu/work/runs/2026-10-29-clearmind-bench/agy-c-check/results-after-bm25.json`
   - Rows: `/home/ubuntu/work/runs/2026-10-29-clearmind-bench/agy-c-check/rows-before-bm25.jsonl`
   - Rows: `/home/ubuntu/work/runs/2026-10-29-clearmind-bench/agy-c-check/rows-after-bm25.jsonl`
   - Report: `/home/ubuntu/work/runs/2026-10-29-clearmind-bench/agy-c-check/report.md`
3. **Repository Cleanliness**:
   - Only files in `bench/` were edited.
   - No git commits created.
   - Zero network requests executed.
