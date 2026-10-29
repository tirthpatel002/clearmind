# Evaluation

LongMemEval and the other benchmark harnesses live outside this tree, in the `eval-lme` worktree
(`../clearmind-eval-lme`, branch `eval-lme`), so long-running evaluations never share a working tree with
development. Results and the method are summarised in the root README under "Benchmarks".

The small in-repo checks are under `scripts/` (`abstain-eval.ts`, `abstain-ask.ts`, `bench.ts`, `scale.ts`).
