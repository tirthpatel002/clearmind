// Every call to the server lives here.
import type {
  AccessLogPage, AskResult, ExtractedFact, Graph, Grant, ImportFormat, ImportResult, InsightsPage, Memory, MemoryPage,
  StateResponse,
} from "@clearmind/core/types";
import { $ } from "./dom.js";

/** Shows the sign-in dialog; set by main so this module stays free of view code. */
function askToSignIn(): void {
  $("signin").classList.add("on");
  setTimeout(() => $("siUser").focus(), 50);
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  const init: RequestInit =
    body === undefined
      ? {}
      : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  const r = await fetch(path, init);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) {
    askToSignIn();
    throw new Error("sign in first");
  }
  if (!r.ok) throw new Error(j.error || r.status);
  return j as T;
}

/**
 * Drops stale replies: take a ticket before a request, and only use the reply if the ticket is still current.
 * Starting a new request (or calling skip) makes earlier tickets stale.
 */
export class ReplyGuard {
  private seq = 0;

  take(): number {
    return ++this.seq;
  }

  skip(): void {
    this.seq++;
  }

  current(ticket: number): boolean {
    return ticket === this.seq;
  }
}

const enc = encodeURIComponent;

export const api = {
  state: (tzOffsetMin: number) => request<StateResponse>("/api/state?tz=" + tzOffsetMin),
  memories: (query: string, cursor?: string | null) =>
    request<MemoryPage>("/api/memories?" + query + (cursor ? "&cursor=" + enc(cursor) : "")),
  history: (id: string) => request<Memory[]>("/api/memories/" + id + "/history"),
  remember: (text: string, tags: string[]) => request<Memory & { confirmed?: boolean }>("/api/memories", { text, tags }),
  correct: (id: string, text: string) => request<Memory>("/api/memories/" + id + "/update", { text }),
  confirm: (id: string) => request<Memory>("/api/memories/" + id + "/confirm", {}),
  log: (query: string, cursor?: number | null) =>
    request<AccessLogPage>("/api/log?limit=60&" + query + (cursor ? "&cursor=" + cursor : "")),
  insights: (kind: "conflicts" | "patterns", cursor?: number | null) =>
    request<InsightsPage>("/api/insights?kind=" + kind + "&limit=12" + (cursor ? "&cursor=" + cursor : "")),
  graph: (scope?: string | null) => request<Graph>("/api/graph" + (scope ? "?scope=" + enc(scope) : "")),
  grant: (g: { agentId: string; tags: string[]; purposes: string[]; ttlMin: string | null }) => request<Grant>("/api/grants", g),
  revoke: (id: string) => request<Grant>("/api/grants/" + id + "/revoke", {}),
  addScope: (name: string) => request<{ scope: string }>("/api/scopes", { name }),
  addAgent: (agentId: string) => request<{ agent: string }>("/api/agents", { agentId }),
  importMemories: (data: string, format: ImportFormat, scope: string) =>
    request<ImportResult>("/api/import", { data, format, scope }),
  extract: (text: string) => request<{ facts: ExtractedFact[] }>("/api/extract", { text }),
  ask: (q: { question: string; agentId: string; purpose: string | null; tags: string[] }) => request<AskResult>("/api/ask", q),
  signIn: (userId: string) => request<{ user: string }>("/api/session", { userId }),
};
