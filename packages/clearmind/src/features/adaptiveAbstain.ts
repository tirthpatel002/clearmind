// 8: adaptive abstention on top of the fixed answerability threshold.
import { lexicalCoverage } from "../abstain.js";

const STOP = new Set(["I", "What", "When", "Where", "Who", "Which", "How", "Why", "Did", "Do", "Does", "Is", "Are", "Was", "Were", "My", "The", "A", "Can", "Should", "Have", "Has"]);

/** Specific terms in the query: capitalised words (not sentence-initial question words) and numbers. */
export function queryEntities(q: string): string[] {
  return [...new Set([...q.matchAll(/\b([A-Z][a-zA-Z0-9'-]+|\d{2,})\b/g)].map((m) => m[1]!).filter((w) => !STOP.has(w)))];
}

/**
 * threshold' = threshold + penalty * (share of query entities found in no candidate) - bonus (if >= 2 candidates
 * each cover >= half of the top candidate's lexical coverage). Returns the adjusted decision.
 */
export function adaptiveAbstain(query: string, candidates: { text: string }[], evidence: number, threshold: number,
  o: { corroborationBonus: number; missingEntityPenalty: number }): { abstained: boolean; threshold: number; missingEntities: string[] } {
  const ents = queryEntities(query);
  const hay = candidates.map((c) => c.text.toLowerCase()).join("\n");
  const missing = ents.filter((e) => !hay.includes(e.toLowerCase()));
  const covs = candidates.map((c) => lexicalCoverage(query, c.text));
  const top = Math.max(0, ...covs);
  const corroborated = top > 0 && covs.filter((c) => c >= top / 2).length >= 2;
  const t = threshold + (ents.length ? o.missingEntityPenalty * (missing.length / ents.length) : 0) - (corroborated ? o.corroborationBonus : 0);
  return { abstained: evidence < t, threshold: Number(t.toFixed(4)), missingEntities: missing };
}
