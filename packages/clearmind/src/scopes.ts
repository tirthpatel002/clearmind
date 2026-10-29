/** Normalise a scope name: lowercase, letters/digits/space/_/-, spaces become dashes, max 32 chars. */
export function normScope(s: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 32);
}
