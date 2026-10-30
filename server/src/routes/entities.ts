// Entities linked to memories (see @clearmind/core entities.ts). Lists are paginated: limit (max 500) and offset.
import { HttpError } from "../http.js";
import type { Route } from "./types.js";

export const entityRoutes: Route[] = [
  { method: "GET", path: "/api/entities", handle: ({ cm, query: q }) => ({
    entities: cm.entities.list({ type: q.get("type") ?? undefined, q: q.get("q") ?? undefined, limit: Math.min(500, Number(q.get("limit") ?? 100)), offset: Number(q.get("offset") ?? 0) }),
    total: cm.entities.total(), counts: cm.entities.counts(),
  }) },
  { method: "GET", path: "/api/entities/search", handle: async ({ cm, query: q, useModel }) => {
    const s = String(q.get("q") ?? "").trim(); if (!s) throw new HttpError(400, "q required");
    useModel(); return { q: s, hits: await cm.entitySearch(s, Number(q.get("k") ?? 5)) };
  } },
  { method: "GET", path: /^\/api\/entities\/([^/]+)$/, handle: async ({ cm, params }) => {
    const d = cm.entities.detail(params[0]!); if (!d) throw new HttpError(404, "no such entity");
    const texts = await cm.textsFor(d.memoryIds);
    return { ...d, memories: d.memoryIds.map((id) => ({ id, text: texts[id] ?? null })).filter((m) => m.text !== null) };
  } },
  { method: "POST", path: /^\/api\/entities\/([^/]+)\/forget$/, handle: async ({ cm, params, body }) => {
    const b = await body(1000); return cm.forgetEntity(params[0]!, { cascade: b.cascade === true });
  } },
  { method: "POST", path: "/api/entities/backfill", handle: ({ cm }) => cm.backfillEntities() },
];
