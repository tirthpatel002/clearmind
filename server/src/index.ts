// @clearmind/server: thin HTTP layer over @clearmind/core. Serves the API and the built web app on one port.
import { createServer } from "node:http";
import { isLoopback, loadConfig } from "@clearmind/core";
import { createApp } from "./app.js";

export { createApp } from "./app.js";
export type { App, AppOptions } from "./app.js";
export { LocalAuth, RateLimiter } from "./auth.js";
export type { AuthProvider } from "./auth.js";
export { HttpError } from "./http.js";

export interface ServeOptions {
  offline?: boolean;
  overrides?: Record<string, unknown>;
  appDir?: string;
}

/** Start the web server and keep running. */
export async function serve(o: ServeOptions = {}): Promise<void> {
  const cfg = loadConfig({ overrides: o.overrides });
  const app = createApp(cfg, { offline: o.offline, appDir: o.appDir });
  const srv = createServer((req, res) => {
    void app.handle(req, res);
  });
  await new Promise<void>((ok) => srv.listen(cfg.port, cfg.host, ok));
  const exposure = isLoopback(cfg.host) ? ", local only" : ", EXPOSED: allowPublic is set";
  const who = cfg.auth.defaultUser ? `, default user ${cfg.auth.defaultUser}` : ", sign-in required";
  console.log(`clearmind web on http://${cfg.host}:${cfg.port} (data ${cfg.dataDir}${exposure}${who})`);
  await new Promise(() => {});
}
