# Clearmind Benchmark Replay Report

## Configurations Evaluated

| Label | System | Retriever | Embedder | k | Git SHA | Total Cases |
|---|---|---|---|---|---|---|
| `/home/ubuntu/work/projects/clearmind/.worktrees/bench/bench/fixtures/results-before-bm25.json` | **before** | bm25 | none | 10 | `2cff2206` | 7 |
| `/home/ubuntu/work/projects/clearmind/.worktrees/bench/bench/fixtures/results-after-bm25.json` | **after** | bm25 | none | 10 | `2cff2206` | 7 |

## Recall & Abstention Overall Summary

| Metric | Baseline (Before) | Clearmind (After) | Delta | Target Direction |
|---|---|---|---|---|
| **Hit@1** (gold mid ranked #1) | 100.0% | 100.0% | 0.0% | Higher is better |
| **MRR@k** (mean reciprocal rank) | 1.0000 | 1.0000 | 0.0000 | Higher is better |
| **Recall@5** (gold in top 5) | 100.0% | 100.0% | 0.0% | Higher is better |
| **Newest Wins** (gold > stale / stale dropped) | 100.0% | 100.0% | 0.0% | Higher is better |
| **Stale Top-1 Rate** (stale fact ranked #1) | 0.0% | 0.0% | 0.0% | Lower is better |
| **Abstain Rate** (on abstention queries) | 100.0% | 100.0% | 0.0% | Higher is better |
| **False Abstain Rate** (empty on answerable) | 0.0% | 0.0% | 0.0% | Lower is better |

## Access Policy Overall Summary

| Metric | Baseline (Before) | Clearmind (After) | Delta | Target Direction |
|---|---|---|---|---|
| **Decision Accuracy** (allowed/denied match) | 33.3% | 100.0% | +66.7% | Higher is better |
| **Leak Rate on Denied** (protected mid leaked) | 100.0% | 0.0% | -100.0% | Lower is better (0% ideal) |
| **Leak Rate Overall** (all policy cases) | 66.7% | 0.0% | -66.7% | Lower is better (0% ideal) |
| **Allowed Recall** (allowed mid returned when allowed) | 100.0% | 100.0% | 0.0% | Higher is better |

## Recall & Abstention Breakdown by Category

| Category | Type | Cases | System | Hit@1 | MRR@k | Recall@5 | Newest Wins | Stale Top1 | Abstain Rate | False Abstain |
|---|---|---|---|---|---|---|---|---|---|---|
| knowledge_update | recall | 1 | Before | 100.0% | 1.0000 | 100.0% | 100.0% | 0.0% | - | 0.0% |
| knowledge_update | recall | 1 | After | 100.0% | 1.0000 | 100.0% | 100.0% | 0.0% | - | 0.0% |
| single_session | recall | 1 | Before | 100.0% | 1.0000 | 100.0% | - | - | - | 0.0% |
| single_session | recall | 1 | After | 100.0% | 1.0000 | 100.0% | - | - | - | 0.0% |
| temporal | recall | 1 | Before | 100.0% | 1.0000 | 100.0% | - | - | - | 0.0% |
| temporal | recall | 1 | After | 100.0% | 1.0000 | 100.0% | - | - | - | 0.0% |
| abstention | abstention | 1 | Before | - | - | - | - | - | 100.0% | - |
| abstention | abstention | 1 | After | - | - | - | - | - | 100.0% | - |

## Access Policy Breakdown by Category

| Category | Cases | System | Decision Acc | Leak Rate (Denied) | Leak Rate (Overall) | Allowed Recall |
|---|---|---|---|---|---|---|
| allowed | 1 | Before | 100.0% | - | 0.0% | 100.0% |
| allowed | 1 | After | 100.0% | - | 0.0% | 100.0% |
| after_expiry | 1 | Before | 0.0% | 100.0% | 100.0% | - |
| after_expiry | 1 | After | 100.0% | 0.0% | 0.0% | - |
| cross_user | 1 | Before | 0.0% | 100.0% | 100.0% | - |
| cross_user | 1 | After | 100.0% | 0.0% | 0.0% | - |
