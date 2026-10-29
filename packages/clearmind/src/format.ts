// One-line text formats for memories and log entries (CLI and demo scripts).
import type { AccessLogEntry, Memory } from "./types.js";

export function fmtMemory(m: Memory): string {
  const st = m.status === "active" ? "" : ` [${m.status}${m.replacedBy ? ` -> ${m.replacedBy}` : ""}]`;
  const tags = m.tags.length ? `  #${m.tags.join(" #")}` : "";
  const conf = `(conf ${m.confidence}${m.confirmations ? `, confirmed x${m.confirmations}` : ""})`;
  return `${m.id}${st}  ${m.text}${tags}  ${conf}`;
}

export function fmtLog(e: AccessLogEntry): string {
  const memories = e.memoryIds.length ? ` memories=${e.memoryIds.join(",")}` : "";
  return (
    `#${e.seq} ${e.at} ${e.action.padEnd(6)} agent=${e.agentId} ${e.decision.toUpperCase()} ` +
    `purpose=${e.purpose ?? "-"} scope=[${e.tags.join(",")}] ${e.reason}${memories}`
  );
}
