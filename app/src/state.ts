// Client-side state shared by the views.
import type { AccessLogEntry, Conflict, Graph, Memory, StateResponse, TitledPattern } from "@clearmind/core/types";

interface Paged<T, C> {
  items: T[];
  next: C | null;
  /** The query the items belong to. */
  key: string;
}

export const state = {
  /** Last /api/state reply; set before any view renders. */
  s: null as unknown as StateResponse,
  /** Memory list tab. */
  tab: "active" as "active" | "replaced",
  /** Memory being corrected, if any (pauses refreshes). */
  editing: null as string | null,
  /** Open version histories by memory id. */
  openHist: {} as Record<string, Memory[]>,
  /** Known memory texts by id (for insights and citations). */
  texts: {} as Record<string, string>,
  mem: { items: [], next: null, key: "" } as Paged<Memory, string>,
  log: { items: [], next: null, key: "" } as Paged<AccessLogEntry, number>,
  ins: {
    conflicts: { items: [] as Conflict[], next: null as number | null },
    patterns: { items: [] as TitledPattern[], next: null as number | null },
  },
  graph: null as Graph | null,
  graphScope: null as string | null,
  /** Overview chart range in days. */
  range: 7,
  /** Import card mode. */
  importMode: "import" as "import" | "chat",
  /** Demo defaults were filled into the forms. */
  demoFilled: false,
};

export function memText(id: string): string {
  return state.texts[id] !== undefined ? state.texts[id]! : "(memory)";
}

export function noteTexts(list: { id: string; text: string }[] | undefined): void {
  for (const m of list ?? []) if (m && m.id) state.texts[m.id] = m.text;
}

/** Re-fetch /api/state and re-render; set by main. */
export const app = {
  refresh: async (): Promise<void> => {},
  /** Forget the data signature so the next refresh re-fetches lists, graph and insights. */
  resetSignature: () => {},
  /** Make any in-flight state refresh stale. */
  dropPendingRefresh: () => {},
};
