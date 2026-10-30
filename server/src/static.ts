// Serves the built web app (app/dist): index.html at "/", hashed files under /assets/, and the root app icons.
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerResponse } from "node:http";
import { sendBody } from "./http.js";

/** Default location of the Vite build, relative to this file. */
export const DEFAULT_APP_DIR = fileURLToPath(new URL("../../app/dist", import.meta.url));

const CSP = "default-src 'self' 'unsafe-inline' data:; frame-ancestors 'none'";

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

/** App icons Vite copies from app/public to the dist root. */
const ROOT_ICONS = /^\/(favicon\.ico|icon-\d+\.png)$/;

export class StaticApp {
  private index: string | null = null;

  constructor(private dir: string = DEFAULT_APP_DIR) {}

  /** Handles GET / and GET /assets/*; returns false for anything else. */
  serve(method: string, path: string, res: ServerResponse): boolean {
    if (method !== "GET") return false;
    if (path === "/") {
      this.sendIndex(res);
      return true;
    }
    if (path.startsWith("/assets/") || ROOT_ICONS.test(path)) {
      this.sendAsset(path, res);
      return true;
    }
    return false;
  }

  private sendIndex(res: ServerResponse): void {
    this.index ??= this.read("index.html");
    if (this.index === null) {
      res.writeHead(503, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("The web app is not built yet. Run: pnpm build");
      return;
    }
    sendBody(res, 200, this.index, { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": CSP });
  }

  private sendAsset(path: string, res: ServerResponse): void {
    const rel = normalize(decodeURIComponent(path)).replace(/^[/\\]+/, "");
    const file = join(this.dir, rel);
    if (!(rel.startsWith("assets") || ROOT_ICONS.test("/" + rel)) || !file.startsWith(this.dir) || !existsSync(file)) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("not found");
      return;
    }
    const type = TYPES[extname(file)] ?? "application/octet-stream", h = { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" };
    if (/^(text\/|application\/(javascript|json)|image\/svg)/.test(type)) return sendBody(res, 200, readFileSync(file), h);
    res.writeHead(200, h);
    res.end(readFileSync(file));
  }

  private read(name: string): string | null {
    const f = join(this.dir, name);
    return existsSync(f) ? readFileSync(f, "utf8") : null;
  }
}
