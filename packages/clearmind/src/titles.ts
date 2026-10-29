// Pattern titles: a per-user JSON cache of model-written titles, with a heuristic fallback.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { Pattern } from "./types.js";

export type TitleCache = Record<string, string>;

/** Cache key for a pattern: its terms, sorted. */
export const titleKey = (p: Pattern): string => [...p.terms].sort().join(" ");

export function readTitles(file: string): TitleCache {
  return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
}

export function writeTitles(file: string, cache: TitleCache): void {
  writeFileSync(file, JSON.stringify(cache, null, 2));
}

/** Pick the evidence text that best covers the pattern terms and tidy it into a title. */
export function heuristicTitle(texts: string[], terms: string[]): string {
  const hits = (s: string) => s.split(" ").filter((w) => terms.includes(w.toLowerCase())).length;
  const best = [...texts].sort((a, b) => hits(b) - hits(a) || a.length - b.length)[0] ?? terms.join(" ");
  const t = best.replace(/^[^:]{0,20}:\s*/, "").replace(/^(ordered|grabbed|went to|another)\s+(an?\s+)?/i, "");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Clean a model reply into a title; empty when unusable. */
export function cleanTitle(reply: string): string {
  const title = reply.trim().split("\n").pop()!.replace(/^["'*\s]+|["'.*\s]+$/g, "");
  return title && title.length <= 80 ? title : "";
}
