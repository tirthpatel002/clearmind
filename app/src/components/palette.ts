// Scope colors: well-known scopes get fixed colors, others a stable hashed one.
import { hash } from "../dom.js";

const PALETTE = ["#9CC7E6", "#E9CF73", "#F2A99B", "#9BDDB0", "#C9B3F5", "#F5C08A", "#A8D8D0", "#E7B3D6"];
export const PREFERRED: Record<string, number> = { work: 0, food: 1, health: 2, travel: 3, family: 4 };
const TILE: Record<number, string> = { 0: "sky", 1: "butter", 2: "lilac", 3: "mint", 4: "lilac" };

const slot = (t: string) => (PREFERRED[t] !== undefined ? PREFERRED[t]! : Math.floor(hash(t) * PALETTE.length));

/** Dot color for a scope ("" = untagged). */
export function scopeColor(t: string): string {
  if (!t) return "#C9CDD2";
  return PALETTE[slot(t)]!;
}

/** Card background class for a scope tile. */
export function tileClass(t: string): string {
  const i = slot(t);
  return TILE[i] || ["sky", "butter", "lilac", "mint"][i % 4]!;
}
