// Time-aware query filtering and score boosting for memory recall.
import type { Memory } from "../types.js";
import { parseTime } from "./parse.js";

export interface TimeRecallConfig {
  mode: "off" | "filter" | "boost";
  boost: number;
}

export interface TimeRecallOptions {
  referenceDate?: Date;
  k?: number;
}

/**
 * Applies time-aware query filtering or score boosting to recalled memories.
 *
 * - mode 'off': leaves memories untouched (default behaviour).
 * - mode 'filter': keeps only memories whose createdAt timestamp falls in the parsed range;
 *                  falls back to unfiltered candidates if none match in range.
 * - mode 'boost': multiplies scores of in-range memories by `boost` and re-ranks descending.
 */
export function applyTimeAwareRecall(
  memories: Memory[],
  query: string,
  cfg: TimeRecallConfig,
  opts: TimeRecallOptions = {},
): Memory[] {
  const k = opts.k ?? 5;
  if (cfg.mode === "off" || !memories.length) {
    return memories.slice(0, k);
  }

  const range = parseTime(query, opts.referenceDate ?? new Date());
  if (!range) {
    return memories.slice(0, k);
  }

  const rangeStart = range.start.getTime();
  const rangeEnd = range.end.getTime();

  const isInRange = (m: Memory): boolean => {
    const t = Date.parse(m.createdAt);
    return !Number.isNaN(t) && t >= rangeStart && t < rangeEnd;
  };

  if (cfg.mode === "filter") {
    const inRange = memories.filter(isInRange);
    // Fall back to unfiltered if none match (documented behaviour)
    const result = inRange.length > 0 ? inRange : memories;
    return result.slice(0, k);
  }

  if (cfg.mode === "boost") {
    const boosted = memories.map((m) => {
      if (isInRange(m)) {
        const baseScore = m.score !== undefined ? m.score : 1.0;
        return {
          ...m,
          score: Number((baseScore * cfg.boost).toFixed(4)),
        };
      }
      return m;
    });

    boosted.sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      return sb - sa;
    });

    return boosted.slice(0, k);
  }

  return memories.slice(0, k);
}
