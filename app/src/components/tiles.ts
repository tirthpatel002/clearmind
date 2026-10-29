// Overview stat tiles, each with a notched link badge.
import type { StateResponse } from "@clearmind/core/types";
import { $, svgIcon } from "../dom.js";
import { ICONS } from "./icons.js";

interface Tile {
  cls: string;
  value: number;
  label: string;
  icon: string;
  badge: string;
  /** "bl" puts the badge bottom-left. */
  corner: string;
  view: string;
}

function tiles(s: StateResponse): Tile[] {
  const a = s.access;
  return [
    { cls: "sky", value: s.memories.active, label: "memories", icon: ICONS.memSmall, badge: "background:#fff", corner: "", view: "memory" },
    { cls: "mint", value: a.activeGrants, label: "active grants", icon: ICONS.access, badge: "background:var(--ink);color:#fff", corner: "bl", view: "access" },
    { cls: "mint", value: a.readsAllowed, label: "reads allowed", icon: ICONS.check, badge: "background:var(--mint2)", corner: "", view: "log" },
    { cls: "blk hatch", value: a.readsDenied, label: "reads denied", icon: ICONS.cross, badge: "background:var(--red);color:#fff", corner: "bl", view: "log" },
    { cls: "butter", value: s.insights.conflicts, label: "conflicts to review", icon: ICONS.warn, badge: "background:var(--ink);color:var(--butter)", corner: "", view: "insights" },
    { cls: "lilac", value: s.insights.patterns + s.insights.lessons, label: "habits & lessons", icon: ICONS.insights, badge: "background:#fff", corner: "bl", view: "insights" },
  ];
}

export function renderTiles(s: StateResponse): void {
  $("tiles").innerHTML = tiles(s)
    .map(
      (t) =>
        `<div class="tw ${t.corner}">` +
        `<a class="tb" href="#${t.view}" aria-label="Open ${t.label}" style="${t.badge}">${svgIcon(t.icon)}</a>` +
        `<div class="stat ${t.cls}"><div class="k">${t.label}</div><div class="v">${Number(t.value).toLocaleString()}</div></div>` +
        "</div>",
    )
    .join("");
  $("spendPill").textContent = "$" + s.spendUsd.toFixed(4) + " spent on Token Factory";
}
