// Block 3: learning memory. Pure functions so they are easy to test.

export interface Fact {
  id: string;
  text: string;
  createdAt: string;
  status?: string;
  tags?: string[];
  key?: string | null;
  embedding?: Float32Array | null;
}

// ---------- confidence ----------
export interface ConfidenceState { base: number; confirmations: number; lastConfirmedAt: string }
export interface ConfidenceOptions { halfLifeDays?: number; gain?: number; floor?: number }

/** Each confirmation closes `gain` of the remaining gap to 1. */
export function confirmConfidence(c: number, gain = 0.4): number {
  return Math.min(1, c + (1 - Math.max(0, c)) * gain);
}

/** Confidence decays with time since the last confirmation (half-life), never below `floor`. */
export function effectiveConfidence(s: ConfidenceState, now: Date, o: ConfidenceOptions = {}): number {
  const half = o.halfLifeDays ?? 30, floor = o.floor ?? 0.05;
  const days = Math.max(0, (now.getTime() - Date.parse(s.lastConfirmedAt)) / 864e5);
  return Math.max(floor, s.base * Math.pow(0.5, days / half));
}

// ---------- text helpers ----------
const STOP = new Set("a an the is are was were be been to of in on at for and or with by from as it its this that my our your his her their i we you he she they me us them do does did has have had will would can could should not no yes so than then there here what when where who how which also just very about into over under up down out more most less least".split(" "));
export function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9:.]+/g) ?? []).map((t) => t.replace(/\.$/, "")).filter((t) => t && !STOP.has(t));
}
export function jaccard(a: string, b: string): number {
  const A = new Set(tokens(a)), B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let i = 0; for (const t of A) if (B.has(t)) i++;
  return i / (A.size + B.size - i);
}
function cos(a: Float32Array, b: Float32Array): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i]! * b[i]!; na += a[i]! * a[i]!; nb += b[i]! * b[i]!; }
  return na && nb ? d / Math.sqrt(na * nb) : 0;
}
export function similarity(a: Fact, b: Fact): number {
  if (a.embedding && b.embedding) return cos(a.embedding, b.embedding);
  return jaccard(a.text, b.text);
}
const NUM = /\b\d+(?:[.:]\d+)?\b/g;
const NEG = /\b(not|never|no|don't|doesn't|isn't|aren't|can't|cannot|won't|stopped|quit|no longer)\b/i;

// ---------- duplicates (confirmation evidence) ----------
/** A near-identical active fact counts as confirmation instead of a new memory. */
export function findDuplicate(text: string, facts: Fact[], threshold = 0.8): Fact | null {
  let best: Fact | null = null, bs = 0;
  for (const f of facts) {
    if (f.status && f.status !== "active") continue;
    const s = jaccard(text, f.text);
    if (s > bs && s >= threshold && sameNumbers(text, f.text) && NEG.test(text) === NEG.test(f.text)) { best = f; bs = s; }
  }
  return best;
}
function sameNumbers(a: string, b: string): boolean {
  const x = (a.match(NUM) ?? []).sort().join(","), y = (b.match(NUM) ?? []).sort().join(",");
  return x === y;
}

// ---------- conflicts ----------
export interface Conflict { a: string; b: string; reason: string; similarity: number }

/**
 * Two ACTIVE facts about the same thing that disagree: similar wording/topic but different numbers,
 * or one negates the other. (Same-key facts never conflict: supersession already resolved them.)
 */
export function detectConflicts(facts: Fact[], o: { minSimilarity?: number } = {}): Conflict[] {
  const act = facts.filter((f) => !f.status || f.status === "active");
  const out: Conflict[] = [];
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i]!, b = act[j]!;
    if (a.key && b.key && a.key !== b.key) continue;
    const sim = similarity(a, b);
    const minSim = o.minSimilarity ?? (a.embedding && b.embedding ? 0.75 : 0.3);
    if (sim < minSim) continue;
    const na = a.text.match(NUM) ?? [], nb = b.text.match(NUM) ?? [];
    const negA = NEG.test(a.text), negB = NEG.test(b.text);
    let reason = "";
    if (na.length && nb.length && !sameNumbers(a.text, b.text)) reason = `different values (${na.join(", ")} vs ${nb.join(", ")})`;
    else if (negA !== negB) reason = "one statement negates the other";
    if (reason) out.push({ a: a.id, b: b.id, reason, similarity: Number(sim.toFixed(3)) });
  }
  return out;
}

// ---------- patterns ----------
export interface Pattern { label: string; terms: string[]; evidence: string[]; support: number; distinctDays: number; confidence: number }

/**
 * Patterns from repeated facts: groups of >= minSupport facts (any status: replaced versions are evidence too)
 * that share topic terms, seen on >= minDays distinct days. Confidence grows with support and spread.
 */
export function detectPatterns(facts: Fact[], o: { minSupport?: number; minDays?: number; minShared?: number } = {}): Pattern[] {
  const minSupport = o.minSupport ?? 3, minDays = o.minDays ?? 2, minShared = o.minShared ?? 2;
  const toks = facts.map((f) => new Set(tokens(f.text).filter((t) => !/^\d/.test(t))));
  // single-link clustering on shared-term count
  const parent = facts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < facts.length; i++) for (let j = i + 1; j < facts.length; j++) {
    let s = 0; for (const t of toks[i]!) if (toks[j]!.has(t)) s++;
    const embOk = facts[i]!.embedding && facts[j]!.embedding ? s >= 1 && similarity(facts[i]!, facts[j]!) >= 0.8 : false; // embeddings only link facts that also share a topic term
    if (s >= minShared || embOk) parent[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  facts.forEach((_, i) => { const r = find(i); groups.set(r, [...(groups.get(r) ?? []), i]); });
  const out: Pattern[] = [];
  for (const idx of groups.values()) {
    if (idx.length < minSupport) continue;
    const days = new Set(idx.map((i) => facts[i]!.createdAt.slice(0, 10))).size;
    if (days < minDays) continue;
    const freq = new Map<string, number>();
    for (const i of idx) for (const t of toks[i]!) freq.set(t, (freq.get(t) ?? 0) + 1);
    const terms = [...freq.entries()].filter(([, c]) => c >= Math.ceil(idx.length / 2)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t).slice(0, 5);
    const confidence = Number(Math.min(0.95, 1 - Math.pow(0.6, idx.length - 1) * (days >= 3 ? 0.8 : 1)).toFixed(3));
    out.push({ label: `recurring: ${terms.join(" ")}`, terms, evidence: idx.map((i) => facts[i]!.id), support: idx.length, distinctDays: days, confidence });
  }
  return out.sort((a, b) => b.support - a.support);
}
