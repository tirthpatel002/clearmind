// Agents and access: scopes, agents, grants, revoke, the access log, and asking as an agent.
import { lowConfidence, researchSummary } from "../research.js";
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
    handle: async ({ cm, body, useModel, viewer, user, cfg, research: rs }) => {
      const b = await body(20_000);
      useModel();
      const q = String(b.question ?? ""), o = { viewer, agentId: b.agentId || undefined, purpose: b.purpose || undefined, tags: b.tags?.length ? b.tags : undefined };
      if (o.agentId && o.agentId !== "owner") return cm.ask(q, o); // agents read under their grants; no web research on their behalf
      const ev = await cm.recallWithEvidence(q, 6, undefined, viewer);
      const thr = ev.cosine === null ? cfg.recall.abstain.minEvidenceLexical : cfg.recall.abstain.minEvidence;
      const low = lowConfidence(ev, { minHits: cfg.research.minHits, minEvidence: cfg.research.minEvidence ?? thr });
      const res = await cm.ask(q, { ...o, recalled: ev });
      if (!(res.abstained || low) || !rs) return { ...res, lowConfidence: low, research: null };
      const r = await rs.tryAuto(cm, user, viewer, q), research = researchSummary(r);
      if ("skipped" in r || !r.full.length) return { ...res, lowConfidence: low, research };
      try {
        const ev2 = await cm.recallWithEvidence(q, 6, undefined, viewer), ids = new Set(ev2.memories.map((m) => m.id));
        return { ...(await cm.ask(q, { ...o, recalled: { ...ev2, abstained: false, memories: [...r.full.filter((m) => !ids.has(m.id)), ...ev2.memories] } })), lowConfidence: low, research };
      } catch { return { ...res, lowConfidence: low, research }; }
    },
  },
];
