// Insight cards: conflicts, habits (patterns) and agent lessons.
import type { Conflict, LessonSummary, TitledPattern } from "@clearmind/core/types";
import { act } from "../actions.js";
import { esc, svgIcon } from "../dom.js";
import { memText } from "../state.js";
import { ICONS } from "./icons.js";

const correctButton = (id: string) =>
  `<button class="rb dark" aria-label="Correct" ${act("startEdit", { id })}>${svgIcon(ICONS.pencil)}</button>`;

/** `full` adds the correct buttons (insights view); the overview shows a compact card. */
export function conflictCard(c: Conflict, full: boolean): string {
  const side = (id: string) => `<span>${esc(memText(id))}</span>` + (full ? correctButton(id) : "<span></span>");
  return (
    '<div class="ins butter"><div class="kind">Needs review · conflict</div>' +
    "<h4>These two can't both be true</h4>" +
    `<div class="inner vs">${side(c.a)}${side(c.b)}</div></div>`
  );
}

function evidence(p: TitledPattern): string {
  const items = p.evidence.slice(0, 8).map((id) => `<li>${esc(memText(id))}</li>`);
  const more = p.evidence.length > 8 ? `<li class="small">and ${p.evidence.length - 8} more</li>` : "";
  return `<details><summary>Show evidence</summary><ul>${items.join("")}${more}</ul></details>`;
}

export function patternCard(p: TitledPattern, full: boolean): string {
  const foot = full
    ? evidence(p)
    : `<div class="small" style="color:var(--lilacInk)">confidence ${Math.round(p.confidence * 100)}%</div>`;
  return (
    `<div class="ins lilac"><div class="kind">Habit · ${p.support} times over ${p.distinctDays} days</div>` +
    `<h4>${esc(p.title || p.terms.join(" "))}</h4>${foot}</div>`
  );
}

export function lessonCards(lessons: Record<string, LessonSummary[]>): string[] {
  const out: string[] = [];
  for (const [agent, list] of Object.entries(lessons)) {
    for (const l of list) {
      const when = esc(String(l.trigger).replace(/^when\s+/i, ""));
      out.push(
        `<div class="ins mint tilt"><div class="kind">Lesson · ${esc(agent)}</div><h4>${esc(l.text)}</h4>` +
          `<div class="inner">Learned from a failed run. Applies when ${when}.</div></div>`,
      );
    }
  }
  return out;
}
