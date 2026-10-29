// Top notch navigation and hash routing.
import { $, esc, svgIcon } from "../dom.js";
import { ICONS } from "./icons.js";

export const TITLES = {
  overview: "Overview",
  memory: "Memory",
  access: "Agents & access",
  log: "Access log",
  insights: "Insights",
} as const;

export type ViewName = keyof typeof TITLES;

export function renderNav(): void {
  $("nav").innerHTML = Object.entries(TITLES)
    .map(([k, n]) => `<a href="#${k}" data-v="${k}">${svgIcon(ICONS[k as ViewName])}${esc(n)}</a>`)
    .join("");
}

export function route(): void {
  const v = location.hash.slice(1) || "overview";
  const k = v in TITLES ? v : "overview";
  document.querySelectorAll(".view").forEach((e) => e.classList.toggle("on", e.id === "v-" + k));
  document.querySelectorAll<HTMLAnchorElement>(".notch a").forEach((a) => {
    a.classList.toggle("on", a.dataset.v === k);
    a.setAttribute("aria-current", a.dataset.v === k ? "page" : "false");
  });
}

/** Switch view, then focus and scroll to an element. */
export function go(view: string, focusId?: string): void {
  location.hash = view;
  setTimeout(() => {
    if (!focusId) return;
    const e = $(focusId);
    e.focus();
    e.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 60);
}
