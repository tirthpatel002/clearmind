// "Bring your memories": bulk import (lines, JSON, CSV), or facts proposed from a chat that you pick to keep.
import type { ExtractedFact, ImportFormat } from "@clearmind/core/types";
import { on } from "../actions.js";
import { api } from "../api.js";
import { $, esc, input, select, toast } from "../dom.js";
import { app, state } from "../state.js";

const PLACEHOLDERS = {
  import: "One memory per line, or JSON, or CSV with a text,tags,key header",
  chat: "Paste a conversation. Nemotron proposes facts; you choose which to keep.",
};

const text = () => $<HTMLTextAreaElement>("impText");
const out = (html: string) => ($("impOut").innerHTML = html);

function setMode(mode: "import" | "chat", button: HTMLElement): void {
  state.importMode = mode;
  document.querySelectorAll("#impTabs button").forEach((x) => x.classList.toggle("on", x === button));
  $("impFmt").style.display = mode === "import" ? "" : "none";
  $("impBtn").textContent = mode === "import" ? "Import" : "Find facts";
  text().placeholder = PLACEHOLDERS[mode];
  out("");
}

async function importText(data: string): Promise<void> {
  const r = await api.importMemories(data, select("impFmt").value as ImportFormat, input("impScope").value.trim());
  const skipped = r.skipped ? ", skipped " + r.skipped : "";
  const errors = r.errors.length ? " · " + esc(r.errors.slice(0, 3).join("; ")) : "";
  out(`<p class="small" style="margin-top:10px">Added ${r.added}, confirmed ${r.confirmed}${skipped}${errors}</p>`);
  text().value = "";
  void app.refresh();
}

function proposals(facts: ExtractedFact[]): string {
  if (!facts.length) return '<p class="small">No lasting facts found.</p>';
  const rows = facts.map(
    (f, i) =>
      `<label class="prop"><input type="checkbox" checked data-i="${i}"><span style="flex:1">${esc(f.text)}</span>` +
      `<span class="small">${esc(f.scope || "")}</span></label>`,
  );
  return `<div style="margin-top:10px">${rows.join("")}<div style="margin-top:10px"><button class="btn dark" id="saveProps">Save selected</button></div></div>`;
}

async function saveProposals(facts: ExtractedFact[]): Promise<void> {
  const picked = [...document.querySelectorAll<HTMLInputElement>("#impOut input:checked")].map((i) => facts[+i.dataset.i!]!);
  const data = JSON.stringify(picked.map((f) => ({ text: f.text, tags: f.scope ? [f.scope] : [] })));
  const res = await api.importMemories(data, "json", input("impScope").value.trim());
  out(`<p class="small" style="margin-top:10px">Saved ${res.added}${res.confirmed ? ", confirmed " + res.confirmed : ""}.</p>`);
  text().value = "";
  void app.refresh();
}

async function extractFacts(chat: string): Promise<void> {
  const r = await api.extract(chat);
  out(proposals(r.facts));
  const save = document.getElementById("saveProps");
  if (save) save.onclick = () => void saveProposals(r.facts);
}

async function run(): Promise<void> {
  const b = $<HTMLButtonElement>("impBtn");
  const t = text().value;
  if (!t.trim()) {
    toast("Paste something first");
    return;
  }
  b.disabled = true;
  const label = b.textContent;
  b.textContent = state.importMode === "import" ? "Importing…" : "Reading…";
  try {
    if (state.importMode === "import") await importText(t);
    else await extractFacts(t);
  } catch (e) {
    out(`<p class="small" style="color:var(--red);margin-top:10px">${esc((e as Error).message)}</p>`);
  } finally {
    b.disabled = false;
    b.textContent = label;
  }
}

export function setupImport(): void {
  on({ import: () => void run() });
  document.querySelectorAll<HTMLButtonElement>("#impTabs button").forEach((b) => {
    b.onclick = () => setMode(b.dataset.k as "import" | "chat", b);
  });
}
