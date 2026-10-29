// Memories: list, history, remember, correct, confirm.
import type { MemoryStatusFilter } from "@clearmind/core/types";
import type { Route } from "./types.js";

const opt = (v: string | null) => v ?? undefined;

export const memoryRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/memories",
    handle: ({ cm, cfg, query: q }) =>
      cm.page({
        limit: Number(q.get("limit") ?? cfg.ui.pageSize),
        cursor: q.get("cursor"),
        q: opt(q.get("q")),
        scope: opt(q.get("scope")),
        status: (q.get("status") as MemoryStatusFilter | null) ?? "active",
      }),
  },
  {
    method: "GET",
    path: /^\/api\/memories\/([^/]+)\/history$/,
    handle: ({ cm, params }) => cm.history(params[0]!),
  },
  {
    method: "POST",
    path: "/api/memories",
    handle: async ({ cm, body, useModel }) => {
      const b = await body(100_000);
      useModel();
      return cm.remember(String(b.text ?? ""), { tags: b.tags ?? [], key: b.key || undefined });
    },
  },
  {
    method: "POST",
    path: /^\/api\/memories\/([^/]+)\/update$/,
    handle: async ({ cm, body, useModel, params }) => {
      const b = await body(100_000);
      useModel();
      return cm.update(params[0]!, String(b.text ?? ""));
    },
  },
  {
    method: "POST",
    path: /^\/api\/memories\/([^/]+)\/confirm$/,
    handle: ({ cm, params }) => cm.confirm(params[0]!),
  },
];
