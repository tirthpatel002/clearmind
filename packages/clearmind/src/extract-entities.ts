// Generic, language-level entity extraction; nothing domain-specific. Finds (1) names already known to the store, by
// looking up each 1-4 word n-gram (indexed, O(words)), and (2) capitalised spans that are not sentence-initial
// function words. Relations come from one generic phrase shape: "<Name>[, | is | was] [a|an|the] <up to 4 lowercase
// words> <at|of|for|with|from|in> <Name>", whose predicate is the connecting words themselves (e.g. "designer at").
// Types and fields are not guessed here; an optional model pass (see Clearmind.linkEntities) may propose them as data.
export interface Found { name: string; confidence: number; known?: boolean }
export interface FoundRelation { from: string; predicate: string; to: string }

// English function words and calendar words that start capitalised spans without naming anything.
const STOP = new Set(("a an the and or but if so of in on at to for from with by as is was are were be this that these those it its i we you he she they " +
  "my our your his her their me us them there here then when where what who why how today yesterday tomorrow also just not no yes ok " +
  "monday tuesday wednesday thursday friday saturday sunday mondays tuesdays wednesdays thursdays fridays saturdays sundays " +
  "january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec").split(" "));
const WORD = /[\p{L}\p{N}][\p{L}\p{N}&+.'’-]*/gu;
const isCap = (w: string) => /^\p{Lu}/u.test(w) && !/^\p{N}/u.test(w);
const strip = (w: string) => w.replace(/[.'’-]+$/u, "");

export function extractEntities(text: string, resolveId?: (name: string) => string | null): { entities: Found[]; relations: FoundRelation[] } {
  const out = new Map<string, Found>();
  const add = (name: string, confidence: number, known = false) => { const k = name.toLowerCase(); const f = out.get(k); if (!f || f.confidence < confidence) out.set(k, { name, confidence, ...(known ? { known } : {}) }); };
  for (const sentence of text.split(/(?<=[.!?:;])\s+|\n+|\s[-–—|]\s/)) {
    const ms = [...sentence.matchAll(WORD)];
    const ws = ms.map((m) => strip(m[0]!));
    // gap[i]: true when word i is separated from word i-1 by punctuation, so spans and n-grams never cross it
    const gap = ms.map((m, i) => i > 0 && !/^\s+$/.test(sentence.slice(ms[i - 1]!.index! + ms[i - 1]![0]!.length, m.index!)));
    const used = new Set<number>();
    if (resolveId) for (let n = 4; n >= 1; n--) for (let i = 0; i + n <= ws.length; i++) {
      if ([...Array(n).keys()].some((j) => used.has(i + j) || (j > 0 && gap[i + j]))) continue;
      const g = ws.slice(i, i + n).join(" ");
      if (n === 1 && (STOP.has(g.toLowerCase()) || g.length < 2)) continue;
      if (resolveId(g)) { add(g, 0.9, true); for (let j = 0; j < n; j++) used.add(i + j); }
    }
    let span: string[] = [], start = 0;
    const flush = () => {
      while (span.length && STOP.has(span[0]!.toLowerCase())) { span.shift(); start++; }
      if (span.length > 1 || (span.length === 1 && start > 0 && span[0]!.length > 1)) add(span.join(" "), span.length > 1 ? 0.6 : 0.5);
      span = [];
    };
    ws.forEach((w, i) => {
      if (used.has(i) || !isCap(w) || STOP.has(w.toLowerCase())) { flush(); start = i + 1; return; }
      if (span.length && gap[i]) flush();
      if (!span.length) start = i;
      span.push(w);
    });
    flush();
  }
  const names = [...out.values()].map((f) => f.name).sort((a, b) => b.length - a.length);
  const relations: FoundRelation[] = [];
  if (names.length > 1) {
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const N = `(${names.map(esc).join("|")})`;
    const re = new RegExp(`${N}(?:,| is| was| works as| worked as)? (?:a |an |the )?((?:[\\p{Ll}][\\p{L}-]* ){0,4}?(?:at|of|for|with|from|in)) ${N}`, "gu");
    for (const m of text.matchAll(re)) if (m[1] !== m[3]) relations.push({ from: m[1]!, predicate: m[2]!.trim(), to: m[3]! });
  }
  return { entities: [...out.values()], relations };
}
