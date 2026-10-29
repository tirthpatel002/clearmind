// Memory view: add, search, filter, page, correct, confirm, version history, and the scope side tiles.
import { on, act } from "../actions.js";
import { api } from "../api.js";
import { memoryRow } from "../components/memoryRow.js";
import { moreButton } from "../components/pager.js";
import { tileClass } from "../components/palette.js";
import { $, debounce, esc, input, select, toast } from "../dom.js";
import { app, noteTexts, state } from "../state.js";

function memQuery(): string {
  const status = state.tab === "active" ? "active" : "replaced";
  return "status=" + status + "&q=" + encodeURIComponent(input("mq").value.trim()) + "&scope=" + encodeURIComponent(select("mscope").value);
}

export async function fetchMemories(more = false): Promise<void> {
  const key = memQuery();
  if (!more || key !== state.mem.key) state.mem = { items: [], next: null, key };
  const r = await api.memories(key, more ? state.mem.next : null);
  if (key !== state.mem.key) return;
  state.mem.items = more ? state.mem.items.concat(r.items) : r.items;
  state.mem.next = r.nextCursor;
  noteTexts(r.items);
  renderMemories();
}

function tabs(): string {
  const st = state.s.memories;
  const list: [string, string][] = [["active", "Current · " + st.active], ["replaced", "Corrected · " + st.replaced]];
  return list
    .map(([k, label]) => {
      const on = state.tab === k;
      return `<button role="tab" aria-selected="${on}" class="${on ? "on" : ""}" ${act("memTab", { tab: k })}>${label}</button>`;
    })
    .join("");
}

function emptyText(): string {
  if (input("mq").value.trim() || select("mscope").value) return "No memories match.";
  if (state.tab === "active") return "Nothing here yet. Add something you want your agents to know, or import a list below.";
  return "Nothing corrected yet.";
}

function sideTiles(): string {
  const st = state.s.memories;
  const scopes = Object.entries(st.perScope)
    .slice(0, 8)
    .map(
      ([t, n]) =>
        `<div class="stat ${tileClass(t)}" style="min-height:84px;cursor:pointer" ${act("filterScope", { scope: esc(t) })}>` +
        `<div class="k">${esc(t)}</div><div class="v" style="font-size:30px">${n}</div></div>`,
    );
  return (
    '<div class="stat blk hatch"><div class="k" style="opacity:.7">Corrected, kept as history</div>' +
    `<div class="v">${st.replaced}</div></div>` +
    scopes.join("")
  );
}

export function renderMemories(): void {
  $("memTabs").innerHTML = tabs();
  $("mems").innerHTML = state.mem.items.map(memoryRow).join("") || `<div class="empty">${emptyText()}</div>`;
  $("memMore").innerHTML = moreButton(!!state.mem.next, "memMore");
  $("memSide").innerHTML = sideTiles();
}

function focusEditor(id: string): void {
  setTimeout(() => {
    const e = document.getElementById("ed-" + id) as HTMLInputElement | null;
    if (!e) return;
    e.focus();
    e.select();
    e.scrollIntoView({ block: "center", behavior: "smooth" });
  }, 80);
}

/** Correct a memory; works from other views too (insights) by loading it into the list first. */
export function startEdit(id: string): void {
  if (location.hash !== "#memory") location.hash = "memory";
  if (!state.mem.items.some((m) => m.id === id)) {
    input("mq").value = "";
    select("mscope").value = "";
    state.tab = "active";
    void api.history(id).then((h) => {
      const cur = h[h.length - 1];
      if (!cur || cur.status !== "active") return;
      state.mem.items = [cur].concat(state.mem.items.filter((m) => m.id !== cur.id));
      state.editing = cur.id;
      renderMemories();
      focusEditor(cur.id);
    });
    return;
  }
  state.tab = "active";
  state.editing = id;
  renderMemories();
  focusEditor(id);
}

async function saveEdit(id: string): Promise<void> {
  const e = document.getElementById("ed-" + id) as HTMLInputElement | null;
  if (!e) return;
  const text = e.value.trim();
  if (!text) {
    toast("Type the corrected text");
    return;
  }
  e.disabled = true;
  app.dropPendingRefresh();
  try {
    await api.correct(id, text);
  } catch (err) {
    console.error("correct failed", err);
    toast("Could not save the correction: " + (err as Error).message);
    e.disabled = false;
    return;
  }
  state.editing = null;
  toast("Corrected. The old version is kept in history.");
  state.tab = "active";
  void app.refresh();
}

async function toggleHistory(id: string): Promise<void> {
  if (state.openHist[id]) delete state.openHist[id];
  else state.openHist[id] = await api.history(id);
  renderMemories();
}

async function confirmMemory(id: string): Promise<void> {
  await api.confirm(id);
  toast("Confirmed");
  app.resetSignature();
  void app.refresh();
}

async function addMemory(): Promise<void> {
  const text = input("newText").value.trim();
  if (!text) return;
  const tag = input("newTag").value.trim();
  try {
    const m = await api.remember(text, tag ? [tag] : []);
    input("newText").value = "";
    toast(m.confirmed ? "Already known, confirmed" : "Remembered");
  } catch (e) {
    toast((e as Error).message);
  }
  void app.refresh();
}

export function setupMemory(): void {
  on({
    addMemory: () => void addMemory(),
    memTab: (el) => {
      state.tab = el.dataset.tab as "active" | "replaced";
      void fetchMemories();
    },
    memMore: () => void fetchMemories(true),
    filterScope: (el) => {
      select("mscope").value = el.dataset.scope!;
      void fetchMemories();
    },
    startEdit: (el) => startEdit(el.dataset.id!),
    saveEdit: (el) => void saveEdit(el.dataset.id!),
    cancelEdit: () => {
      state.editing = null;
      renderMemories();
    },
    toggleHistory: (el) => void toggleHistory(el.dataset.id!),
    confirmMemory: (el) => void confirmMemory(el.dataset.id!),
  });
  $("mq").addEventListener("input", debounce(() => void fetchMemories(), 200));
  $("mscope").addEventListener("change", () => void fetchMemories());
  $("newText").addEventListener("keydown", (e) => {
    if (e.key === "Enter") void addMemory();
  });
}
