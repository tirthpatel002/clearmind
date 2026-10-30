// Research & remember: run a web search, distil the results into short factual memories, each kept with its source.
// Generic: the search function and the chat model are injected; nothing here knows about any domain or entity type.
import type { ChatFn } from "./providers/provider.js";

export interface SearchHit { title: string; url: string; content: string }
export interface SearchResult { answer?: string | null; results: SearchHit[]; tool: string; credits: number }
export type SearchFn = (query: string, o: { signal: AbortSignal }) => Promise<SearchResult>;
export interface Distilled { text: string; urls: string[] }

/** Tavily search (basic depth = 1 credit). The key is passed in, never logged; errors carry only the status code. */
export function tavilySearch(apiKey: string, o: { fetch?: typeof fetch; maxResults?: number } = {}): SearchFn {
  const f = o.fetch ?? fetch;
  return async (query, { signal }) => {
    const r = await f("https://api.tavily.com/search", {
      method: "POST", signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query, search_depth: "basic", include_answer: true, max_results: o.maxResults ?? 5 }),
    });
    if (!r.ok) throw new Error(`search failed (HTTP ${r.status})`);
    const j = (await r.json()) as any;
    const results = ((j.results ?? []) as any[]).filter((x) => typeof x?.url === "string" && /^https?:\/\//.test(x.url))
      .map((x) => ({ title: String(x.title ?? x.url).slice(0, 200), url: String(x.url), content: String(x.content ?? "").slice(0, 1500) }));
    return { answer: typeof j.answer === "string" ? j.answer : null, results, tool: "tavily", credits: 1 };
  };
}

const DISTIL = 'From the search results, write 1-5 short, self-contained factual statements that answer or inform the query. Only facts stated in the results; no speculation. Each must cite the result numbers it comes from. Reply JSON {"facts":[{"text":"","sources":[1]}]}.';

/** Distil results into memories with the chat model; without one (or on a bad reply) one memory per result from title + snippet. */
export async function distil(query: string, s: SearchResult, chat?: ChatFn): Promise<{ facts: Distilled[]; model: string | null }> {
  const hits = s.results;
  if (!hits.length) return { facts: [], model: null };
  if (chat) {
    try {
      const ctx = hits.map((h, i) => `[${i + 1}] ${h.title} (${h.url})\n${h.content}`).join("\n\n");
      const r = await chat([{ role: "system", content: DISTIL }, { role: "user", content: `Query: ${query}\n\n${ctx}`.slice(0, 12000) }], { json: true, maxTokens: 600 });
      const j = JSON.parse(r.content.replace(/^```(?:json)?|```$/g, "").trim());
      const facts = ((j.facts ?? []) as any[]).map((f) => ({
        text: String(f?.text ?? "").trim().slice(0, 600),
        urls: [...new Set(((f?.sources ?? []) as unknown[]).map((n) => hits[Number(n) - 1]?.url).filter((u): u is string => !!u))],
      })).filter((f) => f.text && f.urls.length).slice(0, 5);
      if (facts.length) return { facts, model: r.model };
    } catch { /* fall through to the deterministic fallback */ }
  }
  return { facts: hits.slice(0, 5).map((h) => ({ text: `${h.title}: ${h.content.replace(/\s+/g, " ").slice(0, 300)}`.trim(), urls: [h.url] })), model: null };
}
