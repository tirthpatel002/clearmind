// Small DOM and formatting helpers.

/** Element by id (the page's ids are static, so this is never null at runtime). */
export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

export const input = (id: string) => $<HTMLInputElement>(id);
export const select = (id: string) => $<HTMLSelectElement>(id);

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape text for HTML. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]!);
}

/** A 24x24 line icon. */
export const svgIcon = (paths: string) => `<svg viewBox="0 0 24 24">${paths}</svg>`;

/** "just now", "5 min ago", "yesterday", ... */
export function ago(iso: string): string {
  const d = (Date.now() - Date.parse(iso)) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return Math.floor(d / 60) + " min ago";
  if (d < 86400) return Math.floor(d / 3600) + " h ago";
  const n = Math.floor(d / 86400);
  return n === 1 ? "yesterday" : n + " days ago";
}

/** 24-hour hh:mm in local time. */
export const hm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });

/** Local yyyy-mm-dd. */
export const dayKey = (d: Date) =>
  d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

/** Stable hash of a string to [0, 1). */
export function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string): void {
  const t = $("toast");
  t.textContent = message;
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}

export function debounce(f: () => void, ms: number): () => void {
  let h: ReturnType<typeof setTimeout> | undefined;
  return () => {
    clearTimeout(h);
    h = setTimeout(f, ms);
  };
}

/** Checked checkbox values inside a container. */
export const checkedValues = (selector: string) =>
  [...document.querySelectorAll<HTMLInputElement>(`${selector} input:checked`)].map((i) => i.value);
