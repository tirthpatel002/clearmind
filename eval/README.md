# Evaluation

`eval/longmemeval/` is the LongMemEval-S harness (moved here from the `eval-lme` branch). It drives
`@clearmind/core` directly and traces every stage with `@hackkit/observe`; model calls go through
`@hackkit/connector` (both linked from `../hackkit/.worktrees/observability`).

```bash
node --env-file=$HOME/.secrets/hackathon.env --import tsx eval/longmemeval/run.ts \
  --config eval/longmemeval/configs/heldout-modal.json --phase <name> --split dev|heldout|all [--limit N] [--ids a,b]
python3 eval/longmemeval/report_full.py ...   # reports: report.py, report_full.py, latency.py, cost_compare.py
```

`configs/heldout-modal.json` is the frozen held-out config (commit 28d67f5): answer prompt P2
(`answer.system_prompt`, passed as `ClearmindOptions.answerPrompt`), `recall.minEvidence` 0.25, `k` 20.
Thresholds were tuned on the dev split only; the held-out run refuses dev ids.

Small in-repo checks live in `scripts/` (`abstain-eval.ts`, `abstain-ask.ts`, `bench.ts`, `scale.ts`).
