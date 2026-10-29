// Local web app for Clearmind. Multi-user: every request is resolved to a user and every query is scoped to them.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Clearmind } from "./clearmind.js";
import { PAGE } from "./page.js";
import { LocalAuth, RateLimiter } from "./auth.js";
import type { AuthProvider } from "./auth.js";
import { isLoopback, loadConfig } from "./config.js";
import type { Config } from "./config.js";
import { SpendLedger } from "./nebius.js";

class HttpError extends Error { constructor(readonly code: number, m: string) { super(m); } }

async function body(req: IncomingMessage, max: number): Promise<any> {
  let s = ""; for await (const c of req) { s += c; if (s.length > max) throw new HttpError(413, "body too large"); }
  try { return s ? JSON.parse(s) : {}; } catch { throw new HttpError(400, "body is not JSON"); }
}

export interface App { handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>; users: Map<string, Clearmind>; close: () => Promise<void> }

export function createApp(cfg: Config, o: { offline?: boolean; auth?: AuthProvider; now?: () => Date } = {}): App {
  const dir = cfg.dataDir;
  const ledger = new SpendLedger(join(dir, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
  const auth = o.auth ?? new LocalAuth({ defaultUser: cfg.auth.defaultUser });
  const users = new Map<string, Clearmind>();
  const reqLimit = new RateLimiter(cfg.rateLimit.requestsPerMin), modelLimit = new RateLimiter(cfg.rateLimit.modelCallsPerMin);
  const forUser = (u: string) => {
    let cm = users.get(u);
    if (!cm) {
      if (users.size >= 64) { const [k, v] = users.entries().next().value!; users.delete(k); void v.close(); }
      cm = Clearmind.fromEnv(dir, u, { offline: o.offline, config: cfg, ledger, now: o.now }); users.set(u, cm);
    }
    return cm;
  };
  const demoFile = join(dir, "demo.json");
  const isDemo = (u: string) => { try { return existsSync(demoFile) && JSON.parse(readFileSync(demoFile, "utf8")).user === u; } catch { return false; } };
  const send = (res: ServerResponse, code: number, data: unknown, h: Record<string, string> = {}) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", ...h }); res.end(JSON.stringify(data));
  };
  const model = (u: string) => { if (!modelLimit.take(u)) throw new HttpError(429, "too many model calls, try again in a minute"); };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", "http://x"); const p = url.pathname; const m = req.method ?? "GET"; const q = url.searchParams;
    try {
      if (m === "GET" && p === "/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'self' 'unsafe-inline' data:; frame-ancestors 'none'" }); res.end(PAGE); return; }
      if (m === "POST" && p === "/api/session") { const b = await body(req, 10_000); return send(res, 200, { user: String(b.userId) }, { "Set-Cookie": auth.signIn(String(b.userId ?? "")) }); }
      if (m === "POST" && p === "/api/logout") return send(res, 200, { ok: true }, { "Set-Cookie": auth.signOut() });
      if (m === "POST" && req.headers["content-type"]?.split(";")[0] !== "application/json") throw new HttpError(415, "use application/json");
      const user = auth.identify(req);
      if (!user) return send(res, 401, { error: "sign in first", signIn: true });
      if (!reqLimit.take(user)) throw new HttpError(429, "too many requests, slow down");
      const cm = forUser(user);
      let r: RegExpMatchArray | null;

      if (m === "GET" && p === "/api/state") {
        const tz = Number(q.get("tz") ?? 0);
        const [st, ins, scopes] = [await cm.stats(), await cm.insights(), await cm.scopes()];
        const agents = cm.lessonAgents();
        const lessons = Object.fromEntries(await Promise.all(agents.map(async (a) => [a, (await cm.lessons(a)).slice(0, 20).map((l) => ({ id: l.lessonId, text: l.text, trigger: l.trigger, kind: l.kind, status: l.status, confidence: l.confidence }))] as const)));
        return send(res, 200, {
          owner: user, online: cm.online, demo: isDemo(user), memories: st, scopes, agents,
          access: cm.policy.logStats(user, { days: 14, tzOffsetMin: tz }),
          grants: cm.policy.listGrantsPage(user, 100),
          recent: cm.policy.logPage(user, { limit: 6 }).items,
          insights: { conflicts: ins.conflicts.length, patterns: ins.patterns.length, lessons: Object.values(lessons).flat().length, stale: ins.stale,
            top: [...ins.conflicts.slice(0, 1).map((c) => ({ kind: "conflict", ...c })), ...ins.patterns.slice(0, 1).map((x) => ({ kind: "pattern", ...x, evidence: x.evidence.slice(0, 5) }))] },
          texts: await cm.textsFor([...ins.conflicts.slice(0, 1).flatMap((c) => [c.a, c.b]), ...(ins.patterns[0]?.evidence.slice(0, 5) ?? [])]),
          lessons, spendUsd: cm.ledger?.total(user) ?? 0,
          limits: { spendCapUsd: cfg.spend.perUserCapUsd, pageSize: cfg.ui.pageSize },
        });
      }
      if (m === "GET" && p === "/api/memories") return send(res, 200, await cm.page({ limit: Number(q.get("limit") ?? cfg.ui.pageSize), cursor: q.get("cursor"), q: q.get("q") ?? undefined, scope: q.get("scope") ?? undefined, status: (q.get("status") as any) ?? "active" }));
      if (m === "GET" && p === "/api/log") return send(res, 200, cm.policy.logPage(user, { limit: Number(q.get("limit") ?? cfg.ui.pageSize), cursor: q.get("cursor") ? Number(q.get("cursor")) : null, q: q.get("q") ?? undefined, scope: q.get("scope") ?? undefined, agentId: q.get("agent") ?? undefined, decision: q.get("decision") ?? undefined, action: q.get("action") ?? undefined }));
      if (m === "GET" && p === "/api/graph") return send(res, 200, await cm.graph({ scope: q.get("scope") ?? undefined }));
      if (m === "GET" && p === "/api/insights") {
        const ins = await cm.insights(); const kind = q.get("kind") ?? "patterns"; const off = Math.max(0, Number(q.get("cursor") ?? 0)); const lim = Math.min(100, Number(q.get("limit") ?? 12));
        const list: any[] = kind === "conflicts" ? ins.conflicts : ins.patterns;
        const page = list.slice(off, off + lim);
        const texts = await cm.textsFor(page.flatMap((x) => (x.a ? [x.a, x.b] : x.evidence.slice(0, 8))));
        return send(res, 200, { items: page, texts, total: list.length, nextCursor: off + lim < list.length ? off + lim : null, stale: ins.stale });
      }
      if (m === "GET" && (r = p.match(/^\/api\/memories\/([^/]+)\/history$/))) return send(res, 200, await cm.history(r[1]!));
      if (m === "POST" && p === "/api/memories") { const b = await body(req, 100_000); model(user); return send(res, 200, await cm.remember(String(b.text ?? ""), { tags: b.tags ?? [], key: b.key || undefined })); }
      if (m === "POST" && p === "/api/import") { const b = await body(req, cfg.import.maxBytes + 10_000); model(user); return send(res, 200, await cm.importMemories(String(b.data ?? ""), b.format, { defaultScope: b.scope || undefined })); }
      if (m === "POST" && p === "/api/extract") { const b = await body(req, 50_000); model(user); return send(res, 200, { facts: await cm.extract(String(b.text ?? "")) }); }
      if (m === "POST" && (r = p.match(/^\/api\/memories\/([^/]+)\/update$/))) { const b = await body(req, 100_000); model(user); return send(res, 200, await cm.update(r[1]!, String(b.text ?? ""))); }
      if (m === "POST" && (r = p.match(/^\/api\/memories\/([^/]+)\/confirm$/))) return send(res, 200, await cm.confirm(r[1]!));
      if (m === "POST" && p === "/api/scopes") { const b = await body(req, 10_000); return send(res, 200, { scope: cm.addScope(String(b.name ?? "")) }); }
      if (m === "POST" && p === "/api/agents") { const b = await body(req, 10_000); return send(res, 200, { agent: cm.addAgent(String(b.agentId ?? "")) }); }
      if (m === "POST" && p === "/api/grants") { const b = await body(req, 10_000); return send(res, 200, cm.grant({ agentId: b.agentId, tags: b.tags ?? [], purposes: b.purposes ?? [], consentBy: user, ttlMs: b.ttlMin ? Number(b.ttlMin) * 60_000 : null })); }
      if (m === "POST" && (r = p.match(/^\/api\/grants\/([^/]+)\/revoke$/))) return send(res, 200, cm.revoke(r[1]!, user));
      if (m === "POST" && p === "/api/ask") { const b = await body(req, 20_000); model(user); return send(res, 200, await cm.ask(String(b.question ?? ""), { agentId: b.agentId || undefined, purpose: b.purpose || undefined, tags: b.tags?.length ? b.tags : undefined })); }
      send(res, 404, { error: "not found" });
    } catch (e) { send(res, e instanceof HttpError ? e.code : 400, { error: (e as Error).message }); }
  };
  return { handle, users, close: async () => { for (const c of users.values()) await c.close(); } };
}

export async function serve(o: { offline?: boolean; overrides?: Record<string, unknown> } = {}): Promise<void> {
  const cfg = loadConfig({ overrides: o.overrides });
  const app = createApp(cfg, { offline: o.offline });
  const srv = createServer((req, res) => { void app.handle(req, res); });
  await new Promise<void>((ok) => srv.listen(cfg.port, cfg.host, ok));
  console.log(`clearmind web on http://${cfg.host}:${cfg.port} (data ${cfg.dataDir}${isLoopback(cfg.host) ? ", local only" : ", EXPOSED: allowPublic is set"}${cfg.auth.defaultUser ? `, default user ${cfg.auth.defaultUser}` : ", sign-in required"})`);
  await new Promise(() => {});
}
