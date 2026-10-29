// Agent reads per day: a dark stick for allowed, a dashed one for denied.
import type { AccessStats } from "@clearmind/core/types";
import { $, dayKey } from "../dom.js";

function lastDays(n: number): Date[] {
  return [...Array(n)].map((_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (n - 1) + i);
    return d;
  });
}

const stick = (count: number, max: number, cls: string) =>
  `<div class="stick${cls}${count ? "" : " z"}" style="height:${10 + (count / max) * 100}px"></div>`;

/** `range` is 1, 7 or 14 days; at least a week is drawn, with other days dimmed for "today". */
export function renderLollipop(access: AccessStats, range: number): void {
  const n = Math.max(range, 7);
  const days = lastDays(n);
  const counts = days.map((d) => {
    const b = access.byDay[dayKey(d)] || { allowed: 0, denied: 0 };
    return [b.allowed, b.denied] as const;
  });
  const max = Math.max(1, ...counts.map((c) => c[0] + c[1]));
  $("lolli").innerHTML = days
    .map((d, i) => {
      const [allowed, denied] = counts[i]!;
      const today = i === n - 1;
      const dim = range === 1 && !today;
      const tip =
        today && allowed + denied
          ? `<span class="tip">${allowed.toLocaleString()} allowed · ${denied.toLocaleString()} denied</span>`
          : "";
      const label = n > 7 ? d.getDate() : d.toLocaleDateString([], { weekday: "narrow" });
      return (
        `<div class="c" style="${dim ? "opacity:.25" : ""}">` +
        `<div style="display:flex;gap:10px;align-items:flex-end;position:relative">${tip}` +
        stick(allowed, max, "") +
        stick(denied, max, " dn") +
        `</div><div class="d${today ? " today" : ""}">${label}</div></div>`
      );
    })
    .join("");
}
