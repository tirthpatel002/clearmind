// 20: conflict detection among recalled memories: same key with different text, or an explicit supersession.
import type { Memory } from "../types.js";

export interface Conflict { newer: string; older: string; reason: "same-key" | "supersedes" }

export function findConflicts(ms: Memory[]): Conflict[] {
  const out: Conflict[] = [], seen = new Set<string>();
  const add = (a: Memory, b: Memory, reason: Conflict["reason"]) => {
    const [n, o] = a.createdAt >= b.createdAt ? [a, b] : [b, a]; const k = `${n.id}|${o.id}`;
    if (!seen.has(k)) { seen.add(k); out.push({ newer: n.id, older: o.id, reason }); }
  };
  for (const a of ms) for (const b of ms) {
    if (a.id >= b.id) continue;
    if (a.supersedes.includes(b.id) || a.replacedBy === b.id) { add(a, b, "supersedes"); continue; }
    if (b.supersedes.includes(a.id) || b.replacedBy === a.id) { add(a, b, "supersedes"); continue; }
    if (a.key && a.key === b.key && a.text.trim() !== b.text.trim()) add(a, b, "same-key");
  }
  return out;
}

export const conflictNote = (cs: Conflict[]) => cs.length
  ? `CONFLICTS: these memories disagree; the newer one is current unless the question asks about the past. Mention the change when relevant.\n` +
    cs.map((c) => `- [${c.newer}] (newer) vs [${c.older}] (older)`).join("\n") + "\n\n"
  : "";
