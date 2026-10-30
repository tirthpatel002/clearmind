// Memories: list, history, remember, correct, confirm.
import type { MemoryStatusFilter } from "@clearmind/core/types";
import { fullAccess, WORKSPACE, type Viewer } from "@clearmind/core";
import type { Route } from "./types.js";

const opt = (v: string | null) => v ?? undefined;

/** visibleTo from a request body. A restricted viewer may only share with the workspace and/or themself. */
export function visibleToFor(raw: unknown, viewer?: Viewer): string[] | undefined {
  if (!Array.isArray(raw) || !raw.length) return undefined;
  const xs = raw.map(String);
  if (fullAccess(viewer)) return xs;
  return xs.filter((p) => p === WORKSPACE || p === viewer!.id).length ? xs.filter((p) => p === WORKSPACE || p === viewer!.id) : undefined;
}

export const memoryRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/memories",
    handle: ({ cm, cfg, query: q, viewer }) =>
      cm.page({
        viewer,
        limit: Number(q.get("limit") ?? cfg.ui.pageSize),
        offset: Number(q.get("offset") ?? 0),
        cursor: q.get("cursor"),
        q: opt(q.get("q")),
        scope: opt(q.get("scope")),
        status: (q.get("status") as MemoryStatusFilter | null) ?? "active",
      }),
  },
  {
    method: "GET",
    path: /^\/api\/memories\/([^/]+)\/history$/,
    handle: ({ cm, params, viewer }) => cm.history(params[0]!, viewer),
  },
  {
    method: "POST",
    path: "/api/memories",
    handle: async ({ cm, body, useModel, viewer }) => {
      const b = await body(100_000);
      useModel();
      return cm.remember(String(b.text ?? ""), { tags: b.tags ?? [], key: b.key || undefined, visibleTo: visibleToFor(b.visibleTo, viewer) });
    },
  },
  {
    method: "POST",
    path: /^\/api\/memories\/([^/]+)\/update$/,
    handle: async ({ cm, body, useModel, params, viewer }) => {
      const b = await body(100_000);
      useModel();
      return cm.update(params[0]!, String(b.text ?? ""), { viewer, visibleTo: Array.isArray(b.visibleTo) ? visibleToFor(b.visibleTo, viewer) : undefined });
    },
  },
  {
    method: "POST",
    path: /^\/api\/memories\/([^/]+)\/confirm$/,
    handle: async ({ cm, params, viewer }) => {
      if (!(await cm.canSee(params[0]!, viewer))) throw new Error("no such memory");
      return cm.confirm(params[0]!);
    },
  },
];
