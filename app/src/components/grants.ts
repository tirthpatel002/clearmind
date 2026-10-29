// Grants list with revoke buttons.
import type { Grant } from "@clearmind/core/types";
import { act } from "../actions.js";
import { $, ago, esc } from "../dom.js";

function status(g: Grant, off: boolean): string {
  if (g.revokedAt) return "Revoked " + ago(g.revokedAt);
  if (!g.expiresAt) return "No expiry";
  if (off) return "Expired";
  return "Until " + new Date(g.expiresAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function grantRow(g: Grant): string {
  const off = !!(g.revokedAt || (g.expiresAt && Date.parse(g.expiresAt) < Date.now()));
  const revoke = off ? "" : `<button class="rv" ${act("revoke", { id: g.grantId })}>Revoke</button>`;
  return (
    `<div class="grant ${off ? "off" : ""}"><div class="t">` +
    `<b>${esc(g.agentId)}</b> can read <b>${g.tags.map(esc).join(", ")}</b> for ${esc(g.purposes.join(", "))}` +
    `<div class="small">${status(g, off)} · consent by ${esc(g.consentBy)}</div></div>${revoke}</div>`
  );
}

export function renderGrants(grants: Grant[]): void {
  $("grants").innerHTML = grants.map(grantRow).join("") || '<div class="empty">No agent has access yet.</div>';
}
