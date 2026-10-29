// GET /api/insights?kind=conflicts|patterns&cursor=&limit=: paged insights with the texts they reference.
import type { InsightsPage } from "@clearmind/core/types";
import type { Route, RouteContext } from "./types.js";

async function insights({ cm, query: q }: RouteContext): Promise<InsightsPage> {
  const ins = await cm.insights();
  const kind = q.get("kind") ?? "patterns";
  const offset = Math.max(0, Number(q.get("cursor") ?? 0));
  const limit = Math.min(100, Number(q.get("limit") ?? 12));
  const list = kind === "conflicts" ? ins.conflicts : ins.patterns;
  const items = list.slice(offset, offset + limit);
  const ids = items.flatMap((x) => ("a" in x ? [x.a, x.b] : x.evidence.slice(0, 8)));
  return {
    items,
    texts: await cm.textsFor(ids),
    total: list.length,
    nextCursor: offset + limit < list.length ? offset + limit : null,
    stale: ins.stale,
  };
}

export const insightRoutes: Route[] = [{ method: "GET", path: "/api/insights", handle: insights }];
