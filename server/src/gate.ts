// Access-token gate: runs before every route. Off when no token is configured.
// ?token=<exact> sets an HttpOnly cookie (HMAC of the token) and redirects to the same URL without the param.
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";

const COOKIE = "cm_access";

export function resolveAccessToken(o: { file?: string; env?: NodeJS.ProcessEnv } = {}): string | undefined {
  const env = o.env ?? process.env;
  const v = env.CLEARMIND_ACCESS_TOKEN?.trim() || (o.file ? readFileSync(o.file, "utf8").trim() : "");
  return v || undefined;
}

const eq = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Access required · Clearmind</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e6e8ee;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:28rem;padding:2rem;border:1px solid #2a2f3a;border-radius:14px;background:#161a22;text-align:center}h1{margin:0 0 .5rem;font-size:1.35rem}p{margin:.4rem 0;color:#aab1c0}</style></head><body><main><h1>Access required</h1><p>This Clearmind demo is private to the Nebius hackathon judges and organizers.</p><p>Open it with the link you were given.</p></main></body></html>`;

/** Returns a request wrapper; when token is undefined the gate is off and requests pass straight through. */
export function accessGate(token: string | undefined) {
  if (!token) return (_req: IncomingMessage, _res: ServerResponse) => true;
  const sig = createHmac("sha256", token).update("clearmind-access-v1").digest("base64url");
  return (req: IncomingMessage, res: ServerResponse): boolean => {
    const url = new URL(req.url ?? "/", "http://x");
    const given = url.searchParams.get("token");
    const https = (req.socket as { encrypted?: boolean }).encrypted || String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim() === "https";
    if (given !== null && eq(given, token)) {
      url.searchParams.delete("token");
      const q = url.searchParams.toString();
      res.writeHead(302, {
        "Set-Cookie": `${COOKIE}=${sig}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${https ? "; Secure" : ""}`,
        Location: url.pathname + (q ? "?" + q : ""),
        "Cache-Control": "no-store",
      });
      res.end();
      return false;
    }
    const m = /(?:^|;\s*)cm_access=([^;]*)/.exec(String(req.headers.cookie ?? ""));
    if (given === null && m && eq(m[1], sig)) return true;
    const api = url.pathname.startsWith("/api/") || url.pathname === "/api";
    res.writeHead(403, { "Content-Type": api ? "application/json" : "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(api ? JSON.stringify({ error: "access token required" }) : PAGE);
    return false;
  };
}
