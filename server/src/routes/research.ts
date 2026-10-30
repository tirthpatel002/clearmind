// POST /api/research {query, entityId?}: a runtime web search (Tavily) turned into memories with provenance.
// Private to the asker unless the viewer is an admin. Costs 1 Tavily credit per call (basic search) plus one chat call.
import { distil, fullAccess, tavilySearch, WORKSPACE, type SearchFn } from "@clearmind/core";
import { RateLimiter } from "../auth.js";
import { HttpError } from "../http.js";
import type { Route } from "./types.js";

export interface ResearchDeps { search?: SearchFn; apiKey?: () => string | undefined; fetch?: typeof fetch; perMin?: number; perDay?: number; timeoutMs?: number; log?: (line: string) => void }
const MAX_Q = 300;

export function researchRoutes(d: ResearchDeps = {}): Route[] {
  const perMin = new RateLimiter(d.perMin ?? 5), day = new Map<string, { d: string; n: number }>();
  let credits = 0;
  const log = d.log ?? ((l: string) => console.log(l));
  return [{
    method: "POST", path: "/api/research",
    handle: async ({ cm, body, viewer, user, useModel }) => {
      const key = (d.apiKey ?? (() => process.env.TAVILY_API_KEY))();
      const search = d.search ?? (key ? tavilySearch(key, { fetch: d.fetch }) : null);
      if (!search) throw new HttpError(503, "research not configured");
      const b = await body(5000);
      const query = String(b.query ?? "").replace(/\s+/g, " ").trim();
      if (!query) throw new HttpError(400, "query required");
      if (query.length > MAX_Q) throw new HttpError(400, `query too long (max ${MAX_Q} characters)`);
      const entityId = b.entityId ? String(b.entityId) : undefined;
      if (entityId && !(await cm.canSeeEntity(entityId, viewer))) throw new HttpError(404, "no such entity");
      const who = `${user}:${viewer?.id ?? "admin"}`, today = new Date().toISOString().slice(0, 10);
      const dd = day.get(who)?.d === today ? day.get(who)! : { d: today, n: 0 };
      if (dd.n >= (d.perDay ?? 30)) throw new HttpError(429, "daily research limit reached");
      if (!perMin.take(who)) throw new HttpError(429, "too many research requests, try again in a minute");
      dd.n++; day.set(who, dd);
      useModel();
      const ac = new AbortController(), timer = setTimeout(() => ac.abort(), d.timeoutMs ?? 15_000);
      let s;
      try { s = await search(query, { signal: ac.signal }); }
      catch (e) { throw new HttpError(502, ac.signal.aborted ? "research timed out" : /^search failed \(HTTP \d+\)$/.test((e as Error).message) ? (e as Error).message : "search failed"); }
      finally { clearTimeout(timer); }
      credits += s.credits;
      log(`[research] viewer=${viewer?.id ?? "admin"} tool=${s.tool} results=${s.results.length} credits=${s.credits} total=${credits}`);
      const { facts, model } = await distil(query, s, cm.chatFn);
      const visibleTo = fullAccess(viewer) ? [WORKSPACE] : [viewer!.id];
      const fetchedAt = new Date().toISOString(), title = new Map(s.results.map((h) => [h.url, h.title]));
      const memories = [];
      for (const f of facts) {
        const src = f.urls.map((url) => ({ url, title: title.get(url) ?? url, fetchedAt, tool: s.tool, query }));
        const text = `${f.text} Source: ${src[0]!.title.replace(/,/g, " ")}, ${src[0]!.url}`;
        const m = await cm.remember(text, { visibleTo, tags: ["research"], extra: { source: src[0], sources: src, models: { search: s.tool, distil: model ?? "none (title+snippet)" } }, sources: f.urls, fetchedAt });
        if (entityId) cm.entities.link(m.id, entityId, "research", 0.9);
        memories.push({ id: m.id, text: m.text, visibleTo, sources: src });
      }
      return { query, answer: s.answer ?? null, memories, entityId: entityId ?? null, credits: s.credits, model };
    },
  }];
}
