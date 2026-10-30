// Route table types shared by the route modules.
import type { IncomingMessage } from "node:http";
import type { Clearmind, Config, Viewer } from "@clearmind/core";

export interface RouteContext {
  req: IncomingMessage;
  /** The signed-in user; every call below is scoped to them. */
  user: string;
  cm: Clearmind;
  /** Who is looking (req.viewer). undefined = unrestricted (single-user / legacy). Pass to every cm read. */
  viewer?: Viewer | undefined;
  cfg: Config;
  query: URLSearchParams;
  /** Captured groups from a RegExp path. */
  params: string[];
  /** Parse the JSON body (max characters). */
  body(max: number): Promise<any>;
  /** Count a model call against the per-user model rate limit (throws 429). */
  useModel(): void;
  /** Whether this user is the seeded demo user. */
  isDemo(): boolean;
}

export interface Route {
  method: "GET" | "POST";
  path: string | RegExp;
  /** Returns the JSON reply (status 200). */
  handle(ctx: RouteContext): unknown;
}
