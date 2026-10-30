# Clearmind Benchmark Replay Runner

An offline evaluation harness for benchmarking **Clearmind** against the baseline **AgentMemory** store.

## Architecture & Systems Evaluated

1. **Before (Baseline - AgentMemory)**:
   - Uses `AgentMemory` with SQLite store (`agentmemory`).
   - Memories are remembered independently as facts without key-based supersession.
   - Access control policy is absent: an agent read directly executes a recall over the owner's scope (standard behavior of memory systems lacking access control).
2. **After (Clearmind)**:
   - Uses `Clearmind` (`src/index.ts`).
   - Memories are remembered with `remember(text, { tags, key })`. Memories sharing the same `key` automatically supersede older versions, ensuring replaced facts are never returned during recall.
   - Enforces cryptographic/scoped access control policies via `read({ agentId, purpose, tags, query, k })`: checks active, non-expired, unrevoked grants matching purpose and scope.

## CLI Usage

Run the replay runner using `tsx` from the worktree root:

```bash
npx tsx bench/run.mts \
  --data <dataset dir> \
  --system before|after \
  --retriever bm25|embedding \
  [--embedder <path to ESM module>] \
  [--k 10] \
  [--per-category <N>] \
  [--cases <case_id1,case_id2,...>] \
  --out <results.json> \
  --rows <rows.jsonl>
```

### CLI Parameters

| Option | Required | Default | Description |
|---|---|---|---|
| `--data <dir>` | Yes | - | Path to dataset directory (containing `recall.jsonl`, `abstention.jsonl`, `policy.jsonl` or in `data/`) |
| `--system <name>` | Yes | - | System to evaluate: `before` (plain AgentMemory) or `after` (Clearmind) |
| `--retriever <mode>` | Yes | - | Retrieval mode: `bm25` (lexical) or `embedding` (dense vector) |
| `--embedder <path>` | If embedding | - | Path to ESM module exporting `default async (texts: string[]) => Float32Array[]` |
| `--k <num>` | No | `10` | Top-K memories to retrieve per query |
| `--per-category <N>` | No | - | Optional maximum number of cases to evaluate per category |
| `--cases <ids>` | No | - | Optional comma-separated list of case IDs to evaluate |
| `--out <path>` | Yes | - | Destination path for structured summary metrics (`results.json`) |
| `--rows <path>` | Yes | - | Destination path for per-case diagnostic log (`rows.jsonl`) |

## Generating Comparison Reports

Use `bench/report.mts` to generate markdown comparison tables from one or more `results.json` files:

```bash
npx tsx bench/report.mts results-before.json results-after.json [--out report.md]
```

## Evaluated Metrics

### Recall & Abstention Cases
- **Hit@1**: Proportion of answerable cases where rank-1 returned memory is a gold memory (`gold_mids`).
- **MRR@k**: Mean Reciprocal Rank of the first gold memory in the top-K returned results.
- **Recall@5**: Share of gold memories retrieved in the top 5 results.
- **Newest Wins** (cases with `stale_mids`): 1 if a gold memory is returned and ranks above every stale memory (or no stale memory is returned); 0 otherwise.
- **Stale Top-1 Rate**: Proportion of cases with stale memories where a stale memory ranks #1.
- **Abstain Rate**: Rate of abstention (returning an empty result) on abstention cases.
- **False Abstain Rate**: Rate of returning empty results on answerable cases.

### Policy Cases
- **Decision Accuracy**: Proportion of cases where the actual decision (`allowed` or `denied`) matches `expected`.
- **Leak Rate on Denied**: Share of expected-denied cases where any protected memory (`protected_mids`) is returned.
- **Leak Rate Overall**: Share of all policy cases where any protected memory is returned.
- **Allowed Recall**: Share of expected-allowed cases returning at least one allowed memory (`allowed_mids`).

## Fixtures & Self-Testing

Fixtures for unit validation live in `bench/fixtures/`:
- `bench/fixtures/data/recall.jsonl`: 3 cases (`knowledge_update`, `single_session`, `temporal`).
- `bench/fixtures/data/abstention.jsonl`: 1 case (`abstention`).
- `bench/fixtures/data/policy.jsonl`: 3 cases (`allowed`, `after_expiry`, `cross_user`).
- `bench/fixtures/fake-embedder.mjs`: Offline deterministic 64-dimensional feature-hashing unit-vector embedder for testing `--retriever embedding`.

## Datasets and what counts as a benchmark

- Headline: **LongMemEval** (MIT) and **MemoryAgentBench** only.
- **LoCoMo**: reference only, **non-commercial** license (CC BY-NC 4.0).
- `policy.jsonl` (81 cases): **our own stress test (synthetic, not an official benchmark)**.
- Abstention tuning: only the seeded LongMemEval-S dev subset (`~/work/runs/2026-10-29-lme-pilot/dev_ids.json`).
