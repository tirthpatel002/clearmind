// Agents and access: scopes, agents, grants, revoke, the access log, and asking as an agent.
import type { Route } from "./types.js";

const opt = (v: string | null) => v ?? undefined;

export const accessRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/log",
    handle: ({ cm, cfg, user, query: q }) =>
      cm.policy.logPage(user, {
        limit: Number(q.get("limit") ?? cfg.ui.pageSize),
        cursor: q.get("cursor") ? Number(q.get("cursor")) : null,
        q: opt(q.get("q")),
        scope: opt(q.get("scope")),
        agentId: opt(q.get("agent")),
        decision: opt(q.get("decision")),
        action: opt(q.get("action")),
      }),
  },
  {
    method: "POST",
    path: "/api/scopes",
    handle: async ({ cm, body }) => {
      const b = await body(10_000);
      return { scope: cm.addScope(String(b.name ?? "")) };
    },
  },
  {
    method: "POST",
    path: "/api/agents",
    handle: async ({ cm, body }) => {
      const b = await body(10_000);
      return { agent: cm.addAgent(String(b.agentId ?? "")) };
    },
  },
  {
    method: "POST",
    path: "/api/grants",
    handle: async ({ cm, body, user }) => {
      const b = await body(10_000);
      const ttlMs = b.ttlMin ? Number(b.ttlMin) * 60_000 : null;
      return cm.grant({ agentId: b.agentId, tags: b.tags ?? [], purposes: b.purposes ?? [], consentBy: user, ttlMs });
    },
  },
  {
    method: "POST",
    path: /^\/api\/grants\/([^/]+)\/revoke$/,
    handle: ({ cm, user, params }) => cm.revoke(params[0]!, user),
  },
  {
    method: "POST",
    path: "/api/ask",
    handle: async ({ cm, body, useModel }) => {
      const b = await body(20_000);
      useModel();
      return cm.ask(String(b.question ?? ""), {
        agentId: b.agentId || undefined,
        purpose: b.purpose || undefined,
        tags: b.tags?.length ? b.tags : undefined,
      });
    },
  },
];
