// 7: rule-based query decomposition (no model call). Splits on "and"/"also"/"?" between clauses that each
// carry their own question word or verb, and on comparisons ("X or Y", "between X and Y") keeping the shared stem.
const QW = /^(who|what|when|where|which|why|how|did|do|does|is|are|was|were|have|has|can|should)\b/i;

export function decomposeQuery(q: string, maxParts = 3): string[] {
  const parts = q.split(/\?\s*|\s*;\s*|,?\s+(?:and|also|plus)\s+(?=(?:who|what|when|where|which|why|how|did|do|does|is|are|was|were|have|has|can|should)\b)/i)
    .map((s) => s.trim()).filter((s) => s.split(/\s+/).length >= 2);
  if (parts.length > 1) return [...new Set(parts)].slice(0, maxParts);
  const m = q.match(/^(.*?\b(?:between|compare|comparing|versus|vs\.?)\s+)(.+?)\s+(?:and|or|vs\.?|versus)\s+(.+?)\??$/i)
    ?? q.match(/^((?:did|do|does|is|was|which).*?\s)(\w[\w\s-]{0,30}?)\s+or\s+(\w[\w\s-]{0,30}?)\??$/i);
  if (m) return [`${m[1]}${m[2]}`.trim(), `${m[1]}${m[3]}`.trim()].slice(0, maxParts);
  return [q];
}

export const isQuestionClause = (s: string) => QW.test(s.trim());

/** Interleave ranked lists (round robin), de-duplicated by id. */
export function interleave<T extends { id: string }>(lists: T[][], k: number): T[] {
  const out: T[] = [], seen = new Set<string>();
  for (let i = 0; out.length < k && lists.some((l) => i < l.length); i++)
    for (const l of lists) { const x = l[i]; if (x && !seen.has(x.id) && out.length < k) { seen.add(x.id); out.push(x); } }
  return out;
}
