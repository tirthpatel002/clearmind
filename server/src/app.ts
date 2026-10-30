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
import { researchRoutes, type ResearchDeps } from "./routes/research.js";
import { StaticApp } from "./static.js";

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
  /**
   * Resolve the viewer for a request. Default: `req.viewer` when a session middleware (tenancy) set it; otherwise
   * unrestricted only when no workspace users are configured (cfg.workspace.users), else "guest". Headers are never trusted.
   */
  /** Research route dependencies (tests inject a fake search; default reads TAVILY_API_KEY from env). */
  research?: ResearchDeps;
  resolveViewer?: (req: IncomingMessage & { viewer?: Viewer }, user: string) => Viewer | undefined;
}

/** Default viewer resolver (see AppOptions.resolveViewer). */
export function defaultViewer(cfg: Config) {
  return (req: IncomingMessage & { viewer?: Viewer }): Viewer | undefined => {
    if (req.viewer) return req.viewer;
    const users = (cfg as unknown as { workspace?: { users?: unknown[] } }).workspace?.users;
    return Array.isArray(users) && users.length ? { id: "guest" } : undefined;
  };
}

export function createApp(cfg: Config, o: AppOptions = {}): App {
  const dir = cfg.dataDir;
  const ledger = new SpendLedger(join(dir, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
  const auth = o.auth ?? new LocalAuth({ defaultUser: cfg.auth.defaultUser });
  const web = new StaticApp(o.appDir);
  const resolveViewer = o.resolveViewer ?? defaultViewer(cfg);
  const users = new Map<string, Clearmind>();
  const research = researchRoutes(o.research);
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
      if (method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Methods": "GET, POST", "Access-Control-Allow-Headers": "content-type", "Access-Control-Max-Age": "600" }); res.end(); return; }
    }
    try {
      if (web.serve(method, path, res)) return;
      if (method === "POST" && path === "/api/session") return await signIn(res, auth, await readJson(req, 10_000));
      if (method === "POST" && path === "/api/logout") return signOut(res, auth);
      if (method === "POST" && req.headers["content-type"]?.split(";")[0] !== "application/json") {
        throw new HttpError(415, "use application/json");
      }
      const user = auth.identify(req);
      if (!user) return sendJson(res, 401, { error: "sign in first", signIn: true });
      if (!reqLimit.take(user)) throw new HttpError(429, "too many requests, slow down");

      const rr = research.find((r) => r.method === method && r.path === path);
      const found = rr ? { route: rr, params: [] as string[] } : matchRoute(method, path);
      if (!found) return sendJson(res, 404, { error: "not found" });
      const ctx: RouteContext = {
        req,
        user,
        cm: forUser(user),
        viewer: ((req as IncomingMessage & { viewer?: Viewer }).viewer = resolveViewer(req as IncomingMessage & { viewer?: Viewer }, user)),
        cfg,
        query: url.searchParams,
        params: found.params,
        body: (max) => readJson(req, max),
        useModel: () => {
          if (!modelLimit.take(user)) throw new HttpError(429, "too many model calls, try again in a minute");
        },
        isDemo: () => isDemo(user),
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
