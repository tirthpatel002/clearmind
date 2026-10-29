// Insights view (paged conflicts and habits, plus lessons) and the overview's latest-insights row.
import { on } from "../actions.js";
import { api } from "../api.js";
import { conflictCard, lessonCards, patternCard } from "../components/insightCards.js";
import { moreButton } from "../components/pager.js";
import type { Conflict, TitledPattern } from "@clearmind/core/types";
import { $ } from "../dom.js";
import { state } from "../state.js";

interface Paged<T> {
  items: T[];
  next: number | null;
}

function merge<T>(cur: Paged<T>, items: T[], next: number | null, more: boolean): void {
  cur.items = more ? cur.items.concat(items) : items;
  cur.next = next;
}

export async function fetchInsights(kind: "conflicts" | "patterns", more = false): Promise<void> {
  const r = await api.insights(kind, more ? state.ins[kind].next : null);
  Object.assign(state.texts, r.texts);
  if (kind === "conflicts") merge(state.ins.conflicts, r.items as Conflict[], r.nextCursor, more);
  else merge(state.ins.patterns, r.items as TitledPattern[], r.nextCursor, more);
  renderInsights();
}

function renderFull(): void {
  const s = state.s;
  const cards = [
    ...state.ins.conflicts.items.map((c) => conflictCard(c, true)),
    ...state.ins.patterns.items.map((p) => patternCard(p, true)),
    ...lessonCards(s.lessons),
  ];
  const empty = s.insights.stale
    ? "Still reading through your memories…"
    : "Nothing learned yet. Conflicts and habits show up as your memory grows.";
  $("learn").innerHTML =
    cards.map((h) => `<div style="grid-column:span 6">${h}</div>`).join("") || `<div class="empty">${empty}</div>`;
  $("learnMore").innerHTML = moreButton(!!(state.ins.conflicts.next || state.ins.patterns.next), "insightsMore");
}

/** Overview: first, second and last of the top insights and lessons. */
function renderLatest(): void {
  const s = state.s;
  const top = s.insights.top.map((x) => (x.kind === "conflict" ? conflictCard(x, false) : patternCard(x, false)));
  const all = [...top, ...lessonCards(s.lessons)];
  const pick = [all[0], all[1], all[all.length - 1]].filter((x, i, a) => x && a.indexOf(x) === i);
  $("learnMini").innerHTML =
    pick.map((h) => `<div style="grid-column:span 4">${h}</div>`).join("") ||
    '<div class="empty" style="grid-column:1/-1">Nothing learned yet.</div>';
}

export function renderInsights(): void {
  renderFull();
  renderLatest();
}

export function setupInsights(): void {
  on({
    insightsMore: () => {
      if (state.ins.conflicts.next) void fetchInsights("conflicts", true);
      if (state.ins.patterns.next) void fetchInsights("patterns", true);
    },
  });
}
