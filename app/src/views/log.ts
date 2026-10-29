// Access log view and the overview's recent-access card.
import { on } from "../actions.js";
import { api } from "../api.js";
import { logRows } from "../components/logRows.js";
import { moreButton } from "../components/pager.js";
import { $, debounce, input, select } from "../dom.js";
import { state } from "../state.js";

export async function fetchLog(more = false): Promise<void> {
  const key = "q=" + encodeURIComponent(input("lq").value.trim()) + "&decision=" + select("ldec").value;
  if (!more || key !== state.log.key) state.log = { items: [], next: null, key };
  const r = await api.log(key, more ? state.log.next : null);
  if (key !== state.log.key) return;
  state.log.items = more ? state.log.items.concat(r.items) : r.items;
  state.log.next = r.nextCursor;
  renderLog();
}

export function renderLog(): void {
  $("log").innerHTML = logRows(state.log.items);
  $("logMore").innerHTML = moreButton(!!state.log.next, "logMore");
  $("logMini").innerHTML = logRows(state.s.recent.slice(0, 5));
}

export function setupLog(): void {
  on({ logMore: () => void fetchLog(true) });
  $("lq").addEventListener("input", debounce(() => void fetchLog(), 200));
  $("ldec").addEventListener("change", () => void fetchLog());
}
