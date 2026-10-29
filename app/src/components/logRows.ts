// Access log rows.
import type { AccessLogEntry } from "@clearmind/core/types";
import { esc, hm } from "../dom.js";

const LABELS: Record<string, string> = { allowed: "Allowed", denied: "Denied", grant: "Granted" };

/** Strip timestamps and grant ids from a policy reason for display. */
export function cleanReason(r: string): string {
  return esc(
    String(r)
      .replace(/\s*\d{4}-\d\d-\d\dT[\d:.]+Z/g, "")
      .replace(/^grant grt_\w+ was revoked at$/, "access was revoked")
      .replace(/grant grt_\w+,?\s*/, ""),
  );
}

function row(e: AccessLogEntry): string {
  const w = e.action === "read" ? e.decision : e.action;
  const purpose = e.purpose ? " · " + esc(e.purpose) : " · no purpose";
  const saw = e.memoryIds.length ? " · saw " + e.memoryIds.length : "";
  const detail = e.action === "read" ? purpose + saw : "";
  return (
    '<div class="e">' +
    `<span class="ts">${hm(e.at)}</span>` +
    `<span class="pill w ${w}">${LABELS[w] ?? "Revoked"}</span>` +
    `<span><b>${esc(e.agentId)}</b>${detail}<div class="small">${cleanReason(e.reason)}</div></span>` +
    "</div>"
  );
}

export function logRows(list: AccessLogEntry[]): string {
  return list.map(row).join("") || '<div class="empty">No access yet.</div>';
}
