// Progress ticks: the demo story, or first-run setup steps.
import type { StateResponse } from "@clearmind/core/types";
import { $, esc } from "../dom.js";

type Step = [label: string, done: boolean];

function steps(s: StateResponse): Step[] {
  const a = s.access;
  const m = s.memories;
  if (s.demo) {
    return [
      ["Correct a memory", m.replaced > 0],
      ["Ask without a purpose", a.readsDenied > 0],
      ["Grant access", a.grants > 0],
      ["Ask again: allowed", a.readsAllowed > 0],
      ["Revoke", a.revokedGrants > 0],
      ["Review insights", s.insights.conflicts + s.insights.patterns > 0],
    ];
  }
  return [
    ["Add a memory", m.active > 0],
    ["Add an agent", s.agents.length > 0],
    ["Grant access", a.grants > 0],
    ["Ask as the agent", a.readsAllowed + a.readsDenied > 0],
    ["Correct a memory", m.replaced > 0],
    ["Revoke", a.revokedGrants > 0],
  ];
}

export function renderSteps(s: StateResponse): void {
  const st = steps(s);
  const done = st.filter((x) => x[1]).length;
  const next = st.findIndex((x) => !x[1]);
  $("ticks").innerHTML = st
    .map(([label, ok], i) => `<i class="${ok ? "on" : i === next ? "next" : ""}" title="${esc(label)}"></i>`)
    .join("");
  $("progN").textContent = (s.demo ? "Demo " : "Setup ") + done + "/6";
  $("nextStep").textContent = next < 0 ? "Complete" : "Next: " + st[next]![0];
}
