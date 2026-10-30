# Clearmind bench: verified results (Oct 29, 2026, ~7:50 PM IST)

**Which numbers count.** Only official, widely used datasets are benchmarks here. Headline numbers come only from **LongMemEval** (LongMemEval-S cleaned: knowledge_update, single/multi-session, temporal, `_abs`) and **MemoryAgentBench** (conflict_resolution = FactConsolidation, accurate_retrieval). **LoCoMo** rows (30 of the 60 abstention cases) are reference only: LoCoMo is **non-commercial** (CC BY-NC 4.0). The 81 policy cases are **our own stress test (synthetic, not an official benchmark)**. Abstention thresholds are tuned only on the seeded LongMemEval-S dev subset in `~/work/runs/2026-10-29-lme-pilot/dev_ids.json` (3 `_abs` + 47 others); only those ids are excluded from headline scoring.

- Dataset: clearmind-bench v1.0.0, 429 cases (~/work/library/datasets/clearmind-bench/v1, local commit 2841199).
- Runner: `bench/run.mts`, k=10, one fresh store per case. The reviewer ran it independently, not agy.
- before = plain agentmemory main (10b1116), with memories inserted as independent lessons stamped with their dataset dates. It has no keys or supersession and **no access policy layer**, so an agent read is a recall over the owner's scope. Its policy leak rate is high **by construction**: it shows what happens with no policy layer, not a tuned competitor.
- after = Clearmind (worktree base 2cff220), using remember with `key` for supersession and `read()` with grants, purpose, scope, expiry and revoke.
- emb = Qwen/Qwen3-Embedding-8B (Nebius), with cosine scoring in the default WeightedRetriever. Queries are embedded raw.

| category | metric | before BM25 | after BM25 | before emb | after emb |
|---|---|---|---|---|---|
| knowledge_update | newest_wins | 0.528 | 1.000 | 0.509 | 1.000 |
| knowledge_update | hit_at_1 | 0.472 | 0.849 | 0.434 | 0.792 |
| knowledge_update | mrr | 0.717 | 0.915 | 0.682 | 0.884 |
| conflict_resolution | newest_wins | 0.507 | 1.000 | 0.000 | 1.000 |
| conflict_resolution | hit_at_1 | 0.507 | 0.987 | 0.000 | 0.987 |
| conflict_resolution | mrr | 0.753 | 0.993 | 0.496 | 0.993 |
| all answerable (288) | newest_wins | 0.516 | 1.000 | 0.211 | 1.000 |
| all answerable (288) | stale_top1_rate | 0.461 | 0.000 | 0.766 | 0.000 |
| all answerable (288) | hit_at_1 | 0.688 | 0.882 | 0.517 | 0.840 |
| all answerable (288) | mrr | 0.825 | 0.924 | 0.735 | 0.902 |
| temporal | hit_at_1 | 0.775 | 0.775 | 0.725 | 0.725 |
| single_session | hit_at_1 | 0.950 | 0.950 | 0.800 | 0.800 |
| multi_session | hit_at_1 | 0.700 | 0.700 | 0.725 | 0.725 |
| accurate_retrieval | hit_at_1 | 0.950 | 0.950 | 0.900 | 0.900 |
| abstention (30 LongMemEval _abs + 30 LoCoMo, non-commercial) | abstain_rate | 0.017 | 0.017 | 0.000 | 0.000 |
| all answerable (288) | false_abstain_rate | 0.000 | 0.000 | 0.000 | 0.000 |
| policy (our own stress test, synthetic, not an official benchmark) | decision_accuracy | 0.235 | 1.000 | 0.235 | 1.000 |
| policy (our own stress test, synthetic, not an official benchmark) | leak_rate_expected_denied | 0.952 | 0.000 | 0.984 | 0.000 |
| policy (our own stress test, synthetic, not an official benchmark) | leak_rate_overall | 0.778 | 0.000 | 0.926 | 0.000 |
| allowed | allowed_recall | 1.000 | 1.000 | 1.000 | 1.000 |

Notes:
- newest_wins/hit@1 gains come only from supersession (stale facts leave the index). Temporal/single/multi/accurate_retrieval are identical before vs after, as expected.
- Neither system abstains (abstain_rate ~0-2% on 60 unanswerable questions): there is no answerability threshold above minSimilarity. This is open work.
- conflict_resolution uses MemoryAgentBench FactConsolidation, whose updates are deliberately counterfactual. Gold = newest fact in context.
- Baseline recency barely separates old and new facts (dates are years before "now"), so stale-vs-new is close to a tie-break for the baseline. With wall-clock insert times instead of dataset dates, baseline BM25 conflict_resolution newest_wins was 0.76 (versus 0.507 with dates).
- allowed_recall is reported on the `allowed` category only, because cross_user and extraction "allowed" cases have no allowed memories by design.
- Reproduce: `npx tsx bench/run.mts --data <v1> --system before|after --retriever bm25` (embedding: `node --env-file=<env> --import tsx bench/run.mts ... --retriever embedding --embedder <module>`).
