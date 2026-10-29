// First-run cards on the overview, and the sign-in dialog.
import { act, on } from "../actions.js";
import { api } from "../api.js";
import { $, input, toast } from "../dom.js";
import { app, state } from "../state.js";

function card(title: string, text: string, button: string, dark: boolean, view: string, focus: string): string {
  return (
    `<div class="card"><h3>${title}</h3><p class="sub">${text}</p>` +
    `<button class="btn${dark ? " dark" : ""}" ${act("go", { view, focus })}>${button}</button></div>`
  );
}

export function renderOnboarding(): void {
  const m = state.s.memories;
  const empty = !m.active && !m.replaced && !state.s.demo;
  $("onboard").innerHTML = empty
    ? '<div class="onb">' +
      card("1 · Tell it something", "Type a fact you want your agents to know, with a scope like work or health.", "Add a memory", true, "memory", "newText") +
      card("2 · Bring what you have", "Paste notes, a JSON or CSV export, or a chat and pick the facts to keep.", "Import", false, "memory", "impText") +
      card("3 · Let an agent in", "Add an agent, choose scopes and a purpose, and give consent. Revoke any time.", "Add an agent", false, "access", "newAgent") +
      "</div>"
    : "";
}

async function signIn(): Promise<void> {
  const u = input("siUser").value.trim();
  try {
    await api.signIn(u);
    $("signin").classList.remove("on");
    app.resetSignature();
    void app.refresh();
  } catch (e) {
    toast((e as Error).message);
  }
}

export function setupSignIn(): void {
  on({ signIn: () => void signIn() });
  $("siUser").addEventListener("keydown", (e) => {
    if (e.key === "Enter") void signIn();
  });
}
