// Runtime research: a web search distilled into sourced memories. Shared by POST /api/research (manual, e.g. an entity
// card) and the chat routes (automatic when recall abstains or is low-confidence). One instance per app holds the limits:
// per viewer (per minute / per day), a global daily credit cap, and a 24h de-duplication of the same question per viewer.
import { distil, fullAccess, tavilySearch, WORKSPACE, type Clearmind, type Memory, type SearchFn, type Viewer } from "@clearmind/core";
import { RateLimiter } from "./auth.js";

export interface ResearchDeps {
  search?: SearchFn; apiKey?: () => string | undefined; fetch?: typeof fetch;
  perMin?: number; perDay?: number; dailyCredits?: number; auto?: boolean; timeoutMs?: number; dedupeHours?: number;
  log?: (line: string) => void; now?: () => number;
}
export interface ResearchSource { url: string; title: string; fetchedAt: string; tool: string; query: string }
export interface ResearchRun {
  ran: boolean; reused?: boolean; query: string; answer: string | null; credits: number; model: string | null;
  memories: { id: string; text: string; visibleTo: string[]; sources: ResearchSource[] }[]; full: Memory[]; sources: ResearchSource[];
}
export type ResearchOutcome = ResearchRun | { ran: false; skipped: string; reason: ResearchReason };
export const MAX_QUERY = 300;
export type ResearchReason = "not_configured" | "off" | "user_minute" | "user_day" | "workspace_day" | "error";
export class ResearchError extends Error { constructor(public code: number, msg: string, public reason: ResearchReason = "error") { super(msg); } }

const norm = (q: string) => q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export class Researcher {
  private perMin: RateLimiter;
  private day = new Map<string, { d: string; n: number }>();
  private global = { d: "", credits: 0 };
  private seen = new Map<string, { at: number; run: ResearchRun }>();
  credits = 0;
  constructor(private d: ResearchDeps = {}, private cfg: { auto?: boolean; perMin?: number; perDay?: number; dailyCredits?: number; dedupeHours?: number } = {}) {
    this.perMin = new RateLimiter(d.perMin ?? cfg.perMin ?? 5, d.now ?? Date.now);
  }
  get dailyCap() { return this.d.dailyCredits ?? this.cfg.dailyCredits ?? 150; }
  get dayCap() { return this.d.perDay ?? this.cfg.perDay ?? 30; }
  get minuteCap() { return this.d.perMin ?? this.cfg.perMin ?? 5; }
  /** Usage today: workspace total and per viewer key (user:viewer). */
  usage(user: string, viewer?: Viewer) {
    const today = new Date(this.now()).toISOString().slice(0, 10), who = `${user}:${viewer?.id ?? "admin"}`;
    const mine = this.day.get(who)?.d === today ? this.day.get(who)!.n : 0;
    const per = [...this.day].filter(([k, v]) => v.d === today && k.startsWith(`${user}:`)).map(([k, v]) => ({ viewer: k.slice(user.length + 1), used: v.n }));
    return { configured: this.configured, auto: this.auto, workspace: { used: this.global.d === today ? this.global.credits : 0, cap: this.dailyCap }, user: { id: viewer?.id ?? "admin", used: mine, dayCap: this.dayCap, minuteCap: this.minuteCap }, perViewer: per };
  }
  private now() { return (this.d.now ?? Date.now)(); }
  private search(): SearchFn | null {
    if (this.d.search) return this.d.search;
    const key = (this.d.apiKey ?? (() => process.env.TAVILY_API_KEY))();
    return key ? tavilySearch(key, { fetch: this.d.fetch }) : null;
  }
  get configured(): boolean { return !!this.search(); }
  /** Automatic research in chat: on unless config research.auto (or deps.auto) is false. */
  get auto(): boolean { return (this.d.auto ?? this.cfg.auto ?? true) && this.configured; }
  private log(l: string) { (this.d.log ?? ((x: string) => console.log(x)))(l); }

  /** Run (or reuse) research. Throws ResearchError for limits/config/upstream; messages never include secrets. */
  async run(cm: Clearmind, user: string, viewer: Viewer | undefined, rawQuery: string, entityId?: string): Promise<ResearchRun> {
    const search = this.search();
    if (!search) throw new ResearchError(503, "research not configured", "not_configured");
    const query = String(rawQuery ?? "").replace(/\s+/g, " ").trim();
    if (!query) throw new ResearchError(400, "query required");
    if (query.length > MAX_QUERY) throw new ResearchError(400, `query too long (max ${MAX_QUERY} characters)`);
    if (entityId && !(await cm.canSeeEntity(entityId, viewer))) throw new ResearchError(404, "no such entity");
    const who = `${user}:${viewer?.id ?? "admin"}`, t = this.now(), today = new Date(t).toISOString().slice(0, 10);
    const key = `${who}:${entityId ?? ""}:${norm(query)}`, prev = this.seen.get(key);
    if (prev && t - prev.at < (this.d.dedupeHours ?? this.cfg.dedupeHours ?? 24) * 3600_000) {
      const ok = new Set(await cm.filterVisible(prev.run.full.map((m) => m.id), viewer));
      return { ...prev.run, ran: false, reused: true, credits: 0, full: prev.run.full.filter((m) => ok.has(m.id)), memories: prev.run.memories.filter((m) => ok.has(m.id)) };
    }
    if (this.global.d !== today) this.global = { d: today, credits: 0 };
    if (this.global.credits >= this.dailyCap) throw new ResearchError(429, `Live research limit reached: workspace research credits used up for today (${this.global.credits}/${this.dailyCap}).`, "workspace_day");
    const dd = this.day.get(who)?.d === today ? this.day.get(who)! : { d: today, n: 0 };
    if (dd.n >= this.dayCap) throw new ResearchError(429, `Live research limit reached: you used your ${this.dayCap} research credits for today.`, "user_day");
    if (!this.perMin.take(who)) throw new ResearchError(429, `Live research limit reached: ${this.minuteCap} per minute, try again in a minute.`, "user_minute");
    dd.n++; this.day.set(who, dd);
    const ac = new AbortController(), timer = setTimeout(() => ac.abort(), this.d.timeoutMs ?? 15_000);
    let s;
    try { s = await search(query, { signal: ac.signal }); }
    catch (e) { throw new ResearchError(502, ac.signal.aborted ? "research timed out" : /^search failed \(HTTP \d+\)$/.test((e as Error).message) ? (e as Error).message : "search failed"); }
    finally { clearTimeout(timer); }
    this.credits += s.credits; this.global.credits += s.credits;
    this.log(`[research] viewer=${viewer?.id ?? "admin"} tool=${s.tool} results=${s.results.length} credits=${s.credits} total=${this.credits} today=${this.global.credits}`);
    const { facts, model } = await distil(query, s, cm.chatFn);
    const visibleTo = fullAccess(viewer) ? [WORKSPACE] : [viewer!.id];
    const fetchedAt = new Date(t).toISOString(), title = new Map(s.results.map((h) => [h.url, h.title]));
    const memories: ResearchRun["memories"] = [], full: Memory[] = [], all = new Map<string, ResearchSource>();
    for (const f of facts) {
      const src = f.urls.map((url) => ({ url, title: title.get(url) ?? url, fetchedAt, tool: s.tool, query }));
      const text = `${f.text} Source: ${src[0]!.title.replace(/,/g, " ")}, ${src[0]!.url}`;
      const m = await cm.remember(text, { visibleTo, tags: ["research"], extra: { source: src[0], sources: src, models: { search: s.tool, distil: model ?? "none (title+snippet)" } }, sources: f.urls, fetchedAt });
      if (entityId) cm.entities.link(m.id, entityId, "research", 0.9);
      memories.push({ id: m.id, text: m.text, visibleTo, sources: src }); full.push(m);
      for (const x of src) all.set(x.url, x);
    }
    const run: ResearchRun = { ran: true, query, answer: s.answer ?? null, memories, full, sources: [...all.values()], credits: s.credits, model };
    this.seen.set(key, { at: t, run });
    if (this.seen.size > 5000) this.seen.delete(this.seen.keys().next().value!);
    return run;
  }

  /** Chat use: never throws; returns why it was skipped. */
  async tryAuto(cm: Clearmind, user: string, viewer: Viewer | undefined, q: string): Promise<ResearchOutcome> {
    if (!this.configured) return { ran: false, skipped: "research not configured", reason: "not_configured" };
    if (!this.auto) return { ran: false, skipped: "automatic research is off", reason: "off" };
    try { return await this.run(cm, user, viewer, q.slice(0, MAX_QUERY)); }
    catch (e) { return { ran: false, skipped: e instanceof ResearchError ? e.message : "research failed", reason: e instanceof ResearchError ? e.reason : "error" }; }
  }
}

/** Generic low-confidence test on a recall: abstained, fewer than minHits memories, or best evidence below a cutoff. */
export function lowConfidence(ev: { abstained: boolean; memories: unknown[]; evidence: number }, o: { minHits?: number; minEvidence: number }): boolean {
  return ev.abstained || ev.memories.length < (o.minHits ?? 1) || ev.evidence < o.minEvidence;
}

/** Public summary for a chat response. */
export const researchSummary = (r: ResearchOutcome) => "skipped" in r
  ? { ran: false, reason: r.reason, note: r.skipped, memories: [], sources: [], credits: 0 }
  : { ran: r.ran, reused: !!r.reused, memories: r.memories.map((m) => m.id), items: r.memories, sources: r.sources.map((s) => ({ url: s.url, title: s.title })), credits: r.credits, model: r.model };
