// One memory in the timeline: text, meta, history, and confirm/correct actions.
import type { Memory } from "@clearmind/core/types";
import { act } from "../actions.js";
import { ago, esc, svgIcon } from "../dom.js";
import { state } from "../state.js";
import { ICONS } from "./icons.js";
import { scopeColor } from "./palette.js";

function editor(m: Memory): string {
  const id = m.id;
  return (
    '<div class="row">' +
    `<input id="ed-${id}" aria-label="Corrected text" value="${esc(m.text)}" data-enter="saveEdit" data-esc="cancelEdit" data-id="${id}">` +
    `<button class="btn dark" ${act("saveEdit", { id })}>Save</button>` +
    `<button class="btn" ${act("cancelEdit")}>Cancel</button>` +
    "</div>"
  );
}

function text(m: Memory): string {
  const corrected = m.supersedes.length ? `<button class="corr" ${act("toggleHistory", { id: m.id })}>corrected</button>` : "";
  return `<span>${esc(m.text)}</span>` + corrected;
}

function meta(m: Memory): string {
  const pct = Math.round(m.confidence * 100);
  return (
    '<div class="meta">' +
    `<span>${esc(m.tags.join(", "))}</span>` +
    `<span>${ago(m.createdAt)}</span>` +
    '<span title="Confidence rises when confirmed and fades over time">' +
    `<span class="conf"><i style="width:${pct}%"></i></span>${pct}% sure</span>` +
    (m.confirmations ? `<span>confirmed ${m.confirmations}×</span>` : "") +
    "</div>"
  );
}

function history(m: Memory): string {
  const h = state.openHist[m.id];
  if (!h) return "";
  const rows = h.map((v, i) => {
    const t = i === 0 ? `<b>${esc(v.text)}</b>` : `<s>${esc(v.text)}</s>`;
    return `<div>${t} <span class="small">· ${ago(v.createdAt)}</span></div>`;
  });
  return `<div class="hist">${rows.join("")}</div>`;
}

function actions(m: Memory): string {
  return (
    '<div class="acts">' +
    `<button class="rb" ${act("confirmMemory", { id: m.id })} title="Still true" aria-label="Still true">${svgIcon(ICONS.check)}</button>` +
    `<button class="rb dark" ${act("startEdit", { id: m.id })} title="Correct" aria-label="Correct">${svgIcon(ICONS.pencil)}</button>` +
    "</div>"
  );
}

export function memoryRow(m: Memory): string {
  const editing = state.editing === m.id;
  const cls = "mem " + (m.status !== "active" ? "replaced " : "") + (state.openHist[m.id] ? "open" : "");
  const dot = `<span class="sw" style="background:${scopeColor(m.tags[0] || "")}" title="${esc(m.tags.join(", "))}"></span>`;
  const body = `<div class="t">${editing ? editor(m) : text(m)}${meta(m)}${history(m)}</div>`;
  const acts = m.status === "active" && !editing ? actions(m) : "";
  return `<div class="it"><div class="${cls}">${dot}${body}${acts}</div></div>`;
}
