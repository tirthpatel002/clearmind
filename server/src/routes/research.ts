// POST /api/research {query, entityId?}: manual runtime research (the entity card's Research button). See ../research.ts.
import { fullAccess } from "@clearmind/core";
import { HttpError } from "../http.js";
import { ResearchError, type Researcher } from "../research.js";
import type { Route } from "./types.js";

export function researchRoutes(r: Researcher, countUsers?: () => number | null): Route[] {
  return [{
    method: "GET", path: "/api/research/credits",
    handle: ({ user, viewer, research: _r }) => {
      const u = r.usage(user, viewer), n = countUsers?.() ?? null;
      return { configured: u.configured, auto: u.auto, workspace: u.workspace, user: u.user, users: n, usersCounted: "workspace users configured (excluding the guest viewer)", ...(fullAccess(viewer) ? { perViewer: u.perViewer } : {}) };
    },
  }, {
    method: "POST", path: "/api/research",
    handle: async ({ cm, body, viewer, user, useModel }) => {
      if (!r.configured) throw new HttpError(503, "research not configured");
      const b = await body(5000);
      useModel();
      try {
        const x = await r.run(cm, user, viewer, String(b.query ?? ""), b.entityId ? String(b.entityId) : undefined);
        const { full: _f, ...out } = x;
        return { ...out, entityId: b.entityId ?? null };
      } catch (e) { throw e instanceof ResearchError ? new HttpError(e.code, e.message) : e; }
    },
  }];
}
