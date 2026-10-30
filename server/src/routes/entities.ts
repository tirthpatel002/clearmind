// Entities linked to memories (see @clearmind/core entities.ts). Lists are paginated: limit (max 500) and offset.
import { fullAccess } from "@clearmind/core";
import { HttpError } from "../http.js";
import type { Route } from "./types.js";

export const entityRoutes: Route[] = [
  { method: "GET", path: "/api/entities", handle: ({ cm, query: q, viewer }) =>
    cm.entityList({ type: q.get("type") ?? undefined, q: q.get("q") ?? undefined, limit: Math.min(500, Number(q.get("limit") ?? 100)), offset: Number(q.get("offset") ?? 0) }, viewer) },
  { method: "GET", path: "/api/entities/links", handle: async ({ cm, viewer }) => ({ links: await cm.entityLinks(viewer), relations: await cm.entityRelations(viewer) }) },
  { method: "GET", path: "/api/entities/search", handle: async ({ cm, query: q, useModel, viewer }) => {
    const s = String(q.get("q") ?? "").trim(); if (!s) throw new HttpError(400, "q required");
    useModel(); return { q: s, hits: await cm.entitySearch(s, Number(q.get("k") ?? 5), viewer) };
  } },
  { method: "GET", path: /^\/api\/entities\/([^/]+)$/, handle: async ({ cm, params, viewer }) => {
    const d = await cm.entityDetail(params[0]!, viewer); if (!d) throw new HttpError(404, "no such entity");
    const texts = await cm.textsFor(d.memoryIds, viewer);
    return { ...d, memories: d.memoryIds.map((id) => ({ id, text: texts[id] ?? null })).filter((m) => m.text !== null) };
  } },
  { method: "POST", path: /^\/api\/entities\/([^/]+)\/forget$/, handle: async ({ cm, params, body, viewer }) => {
    if (!fullAccess(viewer)) throw new HttpError(403, "only an admin can forget an entity");
    const b = await body(1000); return cm.forgetEntity(params[0]!, { cascade: b.cascade === true });
  } },
  { method: "POST", path: "/api/entities/backfill", handle: ({ cm, viewer }) => { if (!fullAccess(viewer)) throw new HttpError(403, "admin only"); return cm.backfillEntities(); } },
];
