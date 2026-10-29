// Local web app for Clearmind. Binds 127.0.0.1 only.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Clearmind } from "./clearmind.js";
import { PAGE } from "./page.js";

async function body(req: IncomingMessage): Promise<any> {
  let s = ""; for await (const c of req) { s += c; if (s.length > 1e6) throw new Error("body too large"); }
  return s ? JSON.parse(s) : {};
}

export async function serve(o: { dir: string; ownerId: string; port: number; offline: boolean; host?: string }): Promise<void> {
  const cm = Clearmind.fromEnv(o.dir, o.ownerId, { offline: o.offline });
  const send = (res: ServerResponse, code: number, data: unknown) => {
    res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data));
  };
  const srv = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://x"); const p = url.pathname; const m = req.method ?? "GET";
    try {
      if (m === "GET" && p === "/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); res.end(PAGE); return; }
      if (m === "GET" && p === "/api/state") {
        const agents = cm.lessonAgents();
        const lessons = Object.fromEntries(await Promise.all(agents.map(async (a) => [a, await cm.lessons(a)] as const)));
        return send(res, 200, {
          owner: o.ownerId, online: !!cm.ledger && !o.offline && !!process.env.NEBIUS_API_KEY,
          memories: await cm.list(true), grants: cm.policy.listGrants(o.ownerId), log: cm.accessLog().reverse(),
          conflicts: await cm.conflicts(), patterns: await cm.titledPatterns({ minDays: Number(url.searchParams.get("minDays") ?? 2) }),
          lessons: Object.fromEntries(Object.entries(lessons).map(([a, ls]) => [a, ls.map((l) => ({ id: l.lessonId, text: l.text, trigger: l.trigger, kind: l.kind, status: l.status, confidence: l.confidence }))])),
          spendUsd: cm.ledger?.total() ?? 0,
        });
      }
      let r: RegExpMatchArray | null;
      if (m === "GET" && (r = p.match(/^\/api\/memories\/([^/]+)\/history$/))) return send(res, 200, await cm.history(r[1]!));
      if (m === "POST" && p === "/api/memories") { const b = await body(req); return send(res, 200, await cm.remember(String(b.text ?? ""), { tags: b.tags ?? [], key: b.key || undefined })); }
      if (m === "POST" && (r = p.match(/^\/api\/memories\/([^/]+)\/update$/))) { const b = await body(req); return send(res, 200, await cm.update(r[1]!, String(b.text ?? ""))); }
      if (m === "POST" && (r = p.match(/^\/api\/memories\/([^/]+)\/confirm$/))) return send(res, 200, await cm.confirm(r[1]!));
      if (m === "POST" && p === "/api/grants") { const b = await body(req); return send(res, 200, cm.grant({ agentId: b.agentId, tags: b.tags ?? [], purposes: b.purposes ?? [], consentBy: o.ownerId, ttlMs: b.ttlMin ? Number(b.ttlMin) * 60_000 : null })); }
      if (m === "POST" && (r = p.match(/^\/api\/grants\/([^/]+)\/revoke$/))) return send(res, 200, cm.revoke(r[1]!, o.ownerId));
      if (m === "POST" && p === "/api/ask") { const b = await body(req); return send(res, 200, await cm.ask(String(b.question ?? ""), { agentId: b.agentId || undefined, purpose: b.purpose || undefined, tags: b.tags?.length ? b.tags : undefined })); }
      send(res, 404, { error: "not found" });
    } catch (e) { send(res, 400, { error: (e as Error).message }); }
  });
  const host = o.host ?? "127.0.0.1";
  await new Promise<void>((ok) => srv.listen(o.port, host, ok));
  console.log(`clearmind web on http://${host}:${o.port} (data ${o.dir}, ${o.offline ? "offline" : "Nebius online if key present"})`);
  await new Promise(() => {});
}
