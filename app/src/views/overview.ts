// Overview: header, progress, constellation, stat tiles, trust gauge, reads chart, recent access, latest insights.
import { $ } from "../dom.js";
import { renderGauge } from "../components/gauge.js";
import { renderLollipop } from "../components/lollipop.js";
import { renderSteps } from "../components/steps.js";
import { renderTiles } from "../components/tiles.js";
import { state } from "../state.js";

const RANGE_TITLES: Record<number, string> = { 1: "today", 7: "this week", 14: "last 2 weeks" };

export function renderOverview(): void {
  const s = state.s;
  $("model").textContent = s.online ? "Nemotron online" : "offline";
  $("who").textContent = s.owner;
  $("av").textContent = s.owner[0]!.toUpperCase();
  $("today").textContent = new Date().toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export function renderCharts(): void {
  const s = state.s;
  renderSteps(s);
  renderTiles(s);
  renderGauge(s.memories.avgConfidence || 0);
  renderLollipop(s.access, state.range);
}

export function setupOverview(): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("#range button");
  buttons.forEach((b) => {
    b.onclick = () => {
      state.range = +b.dataset.d!;
      buttons.forEach((x) => x.classList.toggle("on", x === b));
      $("lolliT").textContent = "Agent reads, " + RANGE_TITLES[state.range];
      renderLollipop(state.s.access, state.range);
    };
  });
}
