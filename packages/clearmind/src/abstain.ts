// Calibrated abstention: decide whether recalled memories actually answer the query.
import type { Config } from "./config.js";
import { tokens } from "./learning.js";

/** The exact answer used when memory does not contain the answer. */
export const NO_MEMORY = "I don't have that in memory.";

export function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Share of the query's content words that appear in the memory text. */
export function lexicalCoverage(query: string, text: string): number {
  const q = new Set(tokens(query));
  const m = new Set(tokens(text));
  return q.size ? [...q].filter((t) => m.has(t)).length / q.size : 0;
}

/**
 * evidence = alpha*cosine + (1-alpha)*lexical, or lexical alone when there are no vectors.
 * Below the configured threshold the caller should abstain.
 */
export function answerability(
  cosine: number | null,
  lexical: number,
  cfg: Config["recall"]["abstain"],
): { evidence: number; abstained: boolean } {
  const evidence = cosine === null ? lexical : cfg.alpha * Math.max(0, cosine) + (1 - cfg.alpha) * lexical;
  const threshold = cosine === null ? cfg.minEvidenceLexical : cfg.minEvidence;
  return { evidence, abstained: cfg.enabled && evidence < threshold };
}

/** True when a model reply is the "not in memory" answer. */
export function isNoMemoryReply(content: string): boolean {
  return content.trim().toLowerCase().startsWith(NO_MEMORY.toLowerCase().slice(0, 30));
}
