// The HTTP app. Multi-user: every request is resolved to a user and every query is scoped to them.
import { existsSync, readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { Clearmind, SpendLedger } from "@clearmind/core";
import type { Config, Viewer } from "@clearmind/core";
import { LocalAuth, RateLimiter } from "./auth.js";
import type { AuthProvider } from "./auth.js";
import { HttpError, readJson, sendJson } from "./http.js";
import { matchRoute } from "./routes/index.js";
import type { RouteContext } from "./routes/index.js";
import { signIn, signOut } from "./routes/session.js";
import { researchRoutes } from "./routes/research.js";
import { Researcher, type ResearchDeps } from "./research.js";
import { StaticApp } from "./static.js";
import { Workspace } from "./workspace.js";
import { whoAmI } from "./routes/session.js";

/** Open per-user stores kept in memory; the oldest is closed beyond this. */
const MAX_OPEN_USERS = 64;

export interface App {
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
  users: Map<string, Clearmind>;
  close: () => Promise<void>;
}

export interface AppOptions {
  offline?: boolean;
  auth?: AuthProvider;
  now?: () => Date;
  /** Directory of the built web app (defaults to app/dist). */
  appDir?: string;
  /** Workspace users (overrides cfg.auth.workspaceUsers). */
  workspace?: Workspace;
  /**
   * Resolve the viewer for a request. Default: `req.viewer` as set by the session middleware; otherwise
   * unrestricted only when no workspace users are configured (cfg.auth.workspaceUsers), else "guest". Headers are never trusted.
   */
  /** Research route dependencies (tests inject a fake search; default reads TAVILY_API_KEY from env). */
  research?: ResearchDeps;
  /** Number of users in this workspace (tenancy can supply it); default counts cfg.workspace.users minus guest. */
  workspaceUserCount?: () => number | null;
  resolveViewer?: (req: IncomingMessage & { viewer?: Viewer }, user: string) => Viewer | undefined;
}

/** Default viewer resolver (see AppOptions.resolveViewer). */
export function defaultViewer(cfg: Config) {
  return (req: IncomingMessage & { viewer?: Viewer }): Viewer | undefined => {
    if (req.viewer) return req.viewer;
    return cfg.auth.workspaceUsers ? { id: "guest" } : undefined;
  };
}

export function createApp(cfg: Config, o: AppOptions = {}): App {
  const dir = cfg.dataDir;
  const ledger = new SpendLedger(join(dir, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
  const auth = o.auth ?? new LocalAuth({ defaultUser: cfg.auth.defaultUser });
  const web = new StaticApp(o.appDir);
  const resolveViewer = o.resolveViewer ?? defaultViewer(cfg);
  const ws = o.workspace ?? (cfg.auth.workspaceUsers ? Workspace.load(cfg.auth.workspaceUsers, join(dir, "workspace-users.added.json")) : null);
  const addLimit = new RateLimiter(5), addAll = new RateLimiter(30);
  /** In a workspace everyone reads the owner's store; the viewer decides what they see. */
  const owner = cfg.auth.defaultUser ?? "workspace";
  const users = new Map<string, Clearmind>();
  const researcher = new Researcher(o.research, cfg.research);
  const research = researchRoutes(researcher, o.workspaceUserCount ?? (() => (ws ? ws.list().filter((u) => u.role !== "guest").length : null)));
  const reqLimit = new RateLimiter(cfg.rateLimit.requestsPerMin);
  const modelLimit = new RateLimiter(cfg.rateLimit.modelCallsPerMin);

  const forUser = (u: string): Clearmind => {
    let cm = users.get(u);
    if (cm) return cm;
    if (users.size >= MAX_OPEN_USERS) {
      const [oldest, store] = users.entries().next().value!;
      users.delete(oldest);
      void store.close();
    }
    cm = Clearmind.fromEnv(dir, u, { offline: o.offline, config: cfg, ledger, now: o.now });
    users.set(u, cm);
    return cm;
  };

  const demoFile = join(dir, "demo.json");
  const isDemo = (u: string): boolean => {
    try {
      return existsSync(demoFile) && JSON.parse(readFileSync(demoFile, "utf8")).user === u;
    } catch {
      return false;
    }
  };

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? "/", "http://x");
    const path = url.pathname;
    const method = req.method ?? "GET";
    // CORS for a static app hosted elsewhere (e.g. Cloudflare): only origins listed in CLEARMIND_CORS_ORIGINS, with credentials
    const origin = String(req.headers.origin ?? ""), allowed = (process.env.CLEARMIND_CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Access-Control-Allow-Credentials", "true"); res.setHeader("Vary", "Origin");
      if (method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST, DELETE", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "600" }); res.end(); return; }
    }
    try {
      if (web.serve(method, path, res)) return;
      // Viewer middleware: every API request gets req.viewer (workspace: from the session cookie only; legacy: the user, full access)
      const sid = ws ? (auth.session ? auth.session(req) : auth.identify(req)) : auth.identify(req);
      req.viewer = ws ? ws.viewer(sid) : sid ? { id: sid, admin: true } : undefined;
      if (method === "GET" && path === "/api/workspace/users") return ws ? sendJson(res, 200, { users: ws.list() }) : sendJson(res, 404, { error: "no workspace users configured" });
      if (method === "POST" && path === "/api/workspace/users") {
        if (!ws?.canAdd) return sendJson(res, 404, { error: "no workspace users configured" });
        if (req.headers["content-type"]?.split(";")[0] !== "application/json") throw new HttpError(415, "use application/json");
        if (!addLimit.take("add:" + (req.socket.remoteAddress ?? "")) || !addAll.take("all")) throw new HttpError(429, "too many new users, try again in a minute");
        const u = ws.add(((await readJson(req, 2_000)) as { name?: unknown } | null)?.name);
        return sendJson(res, 200, { id: u.id, name: u.name });
      }
      if (method === "POST" && path === "/api/session") return await signIn(res, auth, await readJson(req, 10_000), ws);
      if (method === "GET" && path === "/api/session") return whoAmI(req, res, ws);
      if ((method === "POST" && path === "/api/logout") || (method === "DELETE" && path === "/api/session")) return signOut(res, auth);
      if (method === "POST" && req.headers["content-type"]?.split(";")[0] !== "application/json") {
        throw new HttpError(415, "use application/json");
      }
      const user = ws ? (req.viewer ? owner : null) : auth.identify(req);
      if (!user) return sendJson(res, 401, { error: "sign in first", signIn: true });
      if (!reqLimit.take(req.viewer?.id ?? user)) throw new HttpError(429, "too many requests, slow down");

      const rr = research.find((r) => r.method === method && r.path === path);
      const found = rr ? { route: rr, params: [] as string[] } : matchRoute(method, path);
      if (!found) return sendJson(res, 404, { error: "not found" });
      const ctx: RouteContext = {
        req,
        user,
        cm: forUser(user),
        // privacy resolver runs after the session middleware above (req.viewer already set when signed in)
        viewer: (req.viewer = resolveViewer(req, user)),
        cfg,
        query: url.searchParams,
        params: found.params,
        body: (max) => readJson(req, max),
        useModel: () => {
          if (!modelLimit.take(req.viewer?.id ?? user)) throw new HttpError(429, "too many model calls, try again in a minute");
        },
        isDemo: () => isDemo(user),
        research: researcher,
      };
      sendJson(res, 200, await found.route.handle(ctx));
    } catch (e) {
      sendJson(res, e instanceof HttpError ? e.code : 400, { error: (e as Error).message });
    }
  };

  const close = async () => {
    for (const c of users.values()) await c.close();
  };
  return { handle, users, close };
}
