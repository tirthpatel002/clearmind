// Agents & access view: ask as an agent, grant access with consent, scopes and agents, and the grants list.
import { on } from "../actions.js";
import { api } from "../api.js";
import { renderGrants } from "../components/grants.js";
import { cleanReason } from "../components/logRows.js";
import { $, checkedValues, esc, input, select, toast } from "../dom.js";
import { app, memText, noteTexts, state } from "../state.js";

/** Replace a select's options, keeping the current choice when it still exists. */
function setOptions(id: string, html: string): void {
  const e = select(id);
  const v = e.value;
  e.innerHTML = html;
  if ([...e.options].some((o) => o.value === v)) e.value = v;
}

const option = (t: string) => `<option>${esc(t)}</option>`;

function renderScopeChoices(scopes: string[]): void {
  const box = $("gScopes");
  const checked = new Set(checkedValues("#gScopes"));
  const first = !box.dataset.init;
  box.innerHTML =
    scopes
      .map((t, i) => {
        const on = checked.has(t) || (first && i === 0);
        return `<label><input type="checkbox" value="${esc(t)}"${on ? " checked" : ""}>${esc(t)}</label>`;
      })
      .join("") || '<span class="small">No scopes yet. Add one below or tag a memory.</span>';
  if (scopes.length) box.dataset.init = "1";
}

/** Demo users get the story's question, purpose and scope filled in once. */
function fillDemoDefaults(): void {
  if (!state.s.demo || state.demoFilled) return;
  state.demoFilled = true;
  if (!input("aQ").value) input("aQ").value = "When is my team standup?";
  if (!input("gPurpose").value) input("gPurpose").value = "schedule-meetings";
  if (!input("newTag").value) input("newTag").value = "work";
}

export function fillSelects(): void {
  const { scopes, agents } = state.s;
  setOptions("aAgent", agents.map((a) => `<option value="${esc(a)}">${esc(a)}</option>`).join("") + '<option value="owner">me (owner)</option>');
  setOptions("gAgent", agents.map(option).join("") || '<option value="">add an agent first</option>');
  setOptions("aTags", '<option value="">anything granted</option>' + scopes.map(option).join(""));
  setOptions("mscope", '<option value="">all scopes</option>' + scopes.map(option).join(""));
  $("scopeList").innerHTML = scopes.map((t) => `<option value="${esc(t)}">`).join("");
  renderScopeChoices(scopes);
  fillDemoDefaults();
}

export function renderAccess(): void {
  renderGrants(state.s.grants);
}

async function grant(): Promise<void> {
  if (!select("gAgent").value) {
    toast("Add an agent first");
    $("newAgent").focus();
    return;
  }
  if (!input("gConsent").checked) {
    toast("Tick the consent box first");
    $("gConsent").focus();
    return;
  }
  const tags = checkedValues("#gScopes");
  if (!tags.length) {
    toast("Pick at least one scope");
    return;
  }
  try {
    await api.grant({
      agentId: select("gAgent").value,
      tags,
      purposes: [input("gPurpose").value.trim() || "*"],
      ttlMin: select("gTtl").value || null,
    });
    input("gConsent").checked = false;
    toast("Access granted");
  } catch (e) {
    toast((e as Error).message);
  }
  void app.refresh();
}

async function revoke(id: string): Promise<void> {
  await api.revoke(id);
  toast("Access revoked");
  void app.refresh();
}

async function addScope(): Promise<void> {
  const v = input("newScope").value.trim();
  if (!v) return;
  try {
    const r = await api.addScope(v);
    input("newScope").value = "";
    toast("Scope " + r.scope + " added");
  } catch (e) {
    toast((e as Error).message);
  }
  void app.refresh();
}

async function addAgent(): Promise<void> {
  const v = input("newAgent").value.trim();
  if (!v) return;
  try {
    const r = await api.addAgent(v);
    input("newAgent").value = "";
    toast("Agent " + r.agent + " added");
    await app.refresh();
    select("gAgent").value = r.agent;
    select("aAgent").value = r.agent;
  } catch (e) {
    toast((e as Error).message);
  }
}

function citeSources(answer: string): string {
  return esc(answer).replace(
    /\s*\[([0-9A-Z]{10,})\]/g,
    (_, id: string) => ` <span class="cite" tabindex="0" title="${esc(memText(id))}">source</span>`,
  );
}

async function ask(): Promise<void> {
  const b = $<HTMLButtonElement>("askBtn");
  b.disabled = true;
  b.textContent = "Asking…";
  $("aOut").innerHTML = "";
  try {
    const r = await api.ask({
      question: input("aQ").value,
      agentId: select("aAgent").value,
      purpose: input("aPurpose").value.trim() || null,
      tags: select("aTags").value ? [select("aTags").value] : [],
    });
    noteTexts(r.memories);
    let body: string;
    if (r.decision === "allowed") {
      const n = r.memories.length;
      const read = n ? "Read " + n + " memor" + (n > 1 ? "ies" : "y") + " · " : "";
      const usage = r.usage ? esc(r.usage.model.split("/").pop()) + " · " + r.usage.ms + " ms" : "";
      body = `<div class="answer">${citeSources(r.answer)}</div><div class="small" style="color:var(--mintInk)">${read}${usage}</div>`;
    } else {
      body = `<div class="answer" style="font-size:16px">${cleanReason(r.reason)}</div>`;
    }
    const cls = r.decision + (r.decision === "denied" ? " hatch" : "");
    $("aOut").innerHTML = `<div class="result ${cls}"><div class="st">${r.decision === "allowed" ? "Allowed" : "Denied"}</div>${body}</div>`;
  } catch (e) {
    $("aOut").innerHTML = `<div class="result denied"><div class="why">${esc((e as Error).message)}</div></div>`;
  } finally {
    b.disabled = false;
    b.textContent = "Ask";
    void app.refresh();
  }
}

export function setupAccess(): void {
  on({
    grant: () => void grant(),
    revoke: (el) => void revoke(el.dataset.id!),
    addScope: () => void addScope(),
    addAgent: () => void addAgent(),
    ask: () => void ask(),
  });
  $("aQ").addEventListener("keydown", (e) => {
    if (e.key === "Enter") void ask();
  });
}
