// Retrieval metrics exactly as LongMemEval src/retrieval/eval_utils.py (recall_any, recall_all, ndcg_any; turn->session conversion).
export function dcg(rel: number[], k: number): number {
  const r = rel.slice(0, k); if (!r.length) return 0;
  return r[0]! + r.slice(1).reduce((s, x, i) => s + x / Math.log2(i + 2), 0);
}
export function ndcg(rankings: number[], correct: Set<string>, corpus: string[], k: number): number {
  const rel = corpus.map((d) => (correct.has(d) ? 1 : 0));
  const sorted = rankings.slice(0, k).map((i) => rel[i]!);
  const ideal = dcg([...rel].sort((a, b) => b - a), k);
  return ideal === 0 ? 0 : dcg(sorted, k) / ideal;
}
export function evaluateRetrieval(rankings: number[], correctDocs: string[], corpus: string[], k: number) {
  const recalled = new Set(rankings.slice(0, k).map((i) => corpus[i]!));
  const correct = new Set(correctDocs);
  return { recall_any: correctDocs.some((d) => recalled.has(d)) ? 1 : 0, recall_all: correctDocs.every((d) => recalled.has(d)) ? 1 : 0, ndcg_any: ndcg(rankings, correct, corpus, k) };
}
const strip = (id: string) => id.split("_").slice(0, -1).join("_");
/** Official turn2session: corpus ids are turn/round ids `${session}_${n}`; k grows until k unique sessions are covered. */
export function evaluateTurn2Session(rankings: number[], correctTurnIds: string[], corpusTurnIds: string[], k: number) {
  const correct = [...new Set(correctTurnIds.map(strip))];
  const corpus = corpusTurnIds.map(strip);
  let ek = k; let uniq = new Set(rankings.slice(0, ek).map((i) => corpus[i]!));
  while (ek <= corpus.length && uniq.size < k) { ek++; uniq = new Set(rankings.slice(0, ek).map((i) => corpus[i]!)); }
  return evaluateRetrieval(rankings, correct, corpus, ek);
}
/** Session-level metrics for a ranked list of round ids (best first). Unranked rounds are NOT appended (conservative). */
export function sessionMetrics(rankedRoundIds: string[], allRoundIds: string[], answerRoundIds: string[]) {
  const idx = new Map(allRoundIds.map((r, i) => [r, i]));
  const rankings = rankedRoundIds.map((r) => idx.get(r)!).filter((x) => x !== undefined);
  const out: Record<string, number> = {};
  for (const k of [5, 10]) {
    const s = evaluateTurn2Session(rankings, answerRoundIds, allRoundIds, k);
    out[`recall_any@${k}`] = s.recall_any; out[`recall_all@${k}`] = s.recall_all; out[`ndcg_any@${k}`] = s.ndcg_any;
  }
  // turn(round)-level, as the paper's turn metrics (k=5,10,50)
  for (const k of [5, 10, 50]) {
    const s = evaluateRetrieval(rankings, answerRoundIds, allRoundIds, k);
    out[`turn_recall_all@${k}`] = s.recall_all; out[`turn_ndcg_any@${k}`] = s.ndcg_any;
  }
  return out;
}
