// Clearmind dashboard entry: wires the views together and keeps them fresh.
import "./styles/tokens.css";
import "./styles/layout.css";
import "./styles/components.css";
import { listen, on } from "./actions.js";
import { api, ReplyGuard } from "./api.js";
import { renderConstellation } from "./components/constellation.js";
import { go, renderNav, route } from "./components/nav.js";
import { fillSelects, renderAccess, setupAccess } from "./views/access.js";
import { setupImport } from "./views/import.js";
import { fetchInsights, renderInsights, setupInsights } from "./views/insights.js";
import { fetchLog, renderLog, setupLog } from "./views/log.js";
import { fetchMemories, renderMemories, setupMemory } from "./views/memory.js";
import { renderOnboarding, setupSignIn } from "./views/onboarding.js";
import { renderCharts, renderOverview, setupOverview } from "./views/overview.js";
import { app, noteTexts, state } from "./state.js";

/** Refresh interval for the dashboard. */
const REFRESH_MS = 5000;

const stateGuard = new ReplyGuard();
/** Counts that, when changed, mean the lists, graph and insights need a re-fetch. */
let signature = "";

async function fetchGraph(scope?: string | null): Promise<void> {
  state.graphScope = scope || null;
  state.graph = await api.graph(scope);
  if ("nodes" in state.graph) noteTexts(state.graph.nodes);
  renderConstellation();
}

async function refresh(): Promise<void> {
  if (state.editing) return;
  const ticket = stateGuard.take();
  const next = await api.state(-new Date().getTimezoneOffset());
  if (!stateGuard.current(ticket) || state.editing) return;
  state.s = next;
  renderOverview();
  Object.assign(state.texts, next.texts || {});
  fillSelects();
  renderOnboarding();
  renderAccess();
  renderCharts();
  renderInsights();
  renderLog();
  renderMemories();
  const m = next.memories;
  const sig = [m.active, m.replaced, next.insights.conflicts, next.insights.patterns, next.insights.stale].join("|");
  if (sig !== signature) {
    signature = sig;
    await Promise.all([fetchMemories(), fetchGraph(state.graphScope), fetchInsights("conflicts"), fetchInsights("patterns")]);
  }
  void fetchLog();
}

app.refresh = refresh;
app.resetSignature = () => {
  signature = "";
};
app.dropPendingRefresh = () => stateGuard.skip();

function setup(): void {
  renderNav();
  window.addEventListener("hashchange", () => {
    route();
    window.scrollTo(0, 0);
  });
  route();
  listen();
  on({
    go: (el) => go(el.dataset.view!, el.dataset.focus),
    openScope: (el) => void fetchGraph(el.dataset.scope),
  });
  setupOverview();
  setupMemory();
  setupImport();
  setupAccess();
  setupLog();
  setupInsights();
  setupSignIn();
}

function isTyping(): boolean {
  const a = document.activeElement;
  return !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA");
}

setup();
refresh().catch(() => {});
setInterval(() => {
  if (!document.hidden && !isTyping()) refresh().catch(() => {});
}, REFRESH_MS);
