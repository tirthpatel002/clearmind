// Opt-in answer/recall features. Every default keeps the previous behaviour.
export interface Features {
  /** 6: time-aware recall ("last week", "in March", "2 days ago"): off | filter | boost. */
  time: { mode: "off" | "filter" | "boost"; boost: number; pool: number };
  /** 7: split compound questions into sub-queries and merge their recalls. */
  decompose: { enabled: boolean; maxParts: number };
  /** 8: adaptive abstention: abstain when query entities appear in no candidate; relax when candidates corroborate. */
  adaptiveAbstain: { enabled: boolean; corroborationBonus: number; missingEntityPenalty: number };
  /** 9: provenance + trust labels and spotlighting (datamarked memory blocks) in the ask prompt. */
  provenance: { enabled: boolean; trust: Record<string, "high" | "medium" | "low">; defaultTrust: "high" | "medium" | "low" };
  /** 17: prompt-injection screening of recalled memories: off | flag (label in prompt) | drop. */
  injection: { mode: "off" | "flag" | "drop" };
  /** 20: tell the model about conflicting memories (same key or supersession) and prefer the newest. */
  conflicts: { enabled: boolean };
  /** 21: return evidence spans for citations; `required` makes an uncited answer abstain. */
  citations: { evidence: boolean; required: boolean };
  /** 24: second model call verifying the answer is supported by the cited memories. */
  selfCheck: { enabled: boolean; onUnsupported: "abstain" | "flag" };
}

export const FEATURE_DEFAULTS: Features = {
  time: { mode: "off", boost: 1.5, pool: 20 },
  decompose: { enabled: false, maxParts: 3 },
  adaptiveAbstain: { enabled: false, corroborationBonus: 0.05, missingEntityPenalty: 0.15 },
  provenance: { enabled: false, trust: { user: "high", import: "medium", agent: "low", web: "low" }, defaultTrust: "medium" },
  injection: { mode: "off" },
  conflicts: { enabled: false },
  citations: { evidence: false, required: false },
  selfCheck: { enabled: false, onUnsupported: "abstain" },
};

export function features(f?: { [K in keyof Features]?: Partial<Features[K]> }): Features {
  const out = structuredClone(FEATURE_DEFAULTS) as any;
  for (const [k, v] of Object.entries(f ?? {})) if (v && typeof v === "object") out[k] = { ...out[k], ...v };
  return out as Features;
}
