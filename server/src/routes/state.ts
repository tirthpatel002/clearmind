// GET /api/state: the dashboard summary in one call.
import type { StateResponse } from "@clearmind/core/types";
import type { Route, RouteContext } from "./types.js";

/** Lessons per agent shown on the dashboard. */
const LESSONS_PER_AGENT = 20;

async function state({ cm, cfg, user, query, isDemo, viewer }: RouteContext): Promise<StateResponse> {
  const tz = Number(query.get("tz") ?? 0);
  const [st, ins, scopes] = [await cm.stats(viewer), await cm.insights({ viewer }), await cm.scopes(viewer)];
  const agents = cm.lessonAgents();
  const lessonLists = await Promise.all(
    agents.map(async (a) => {
      const ls = (await cm.lessons(a)).slice(0, LESSONS_PER_AGENT).map((l) => ({
        id: l.lessonId, text: l.text, trigger: l.trigger, kind: l.kind, status: l.status, confidence: l.confidence,
      }));
      return [a, ls] as const;
    }),
  );
  const lessons = Object.fromEntries(lessonLists);
  const topConflict = ins.conflicts.slice(0, 1);
  const topPattern = ins.patterns.slice(0, 1);
  const topIds = [...topConflict.flatMap((c) => [c.a, c.b]), ...(ins.patterns[0]?.evidence.slice(0, 5) ?? [])];
  return {
    owner: user,
    online: cm.online,
    demo: isDemo(),
    memories: st,
    scopes,
    agents,
    access: cm.policy.logStats(user, { days: 14, tzOffsetMin: tz }),
    grants: cm.policy.listGrantsPage(user, 100),
    recent: cm.policy.logPage(user, { limit: 6 }).items,
    insights: {
      conflicts: ins.conflicts.length,
      patterns: ins.patterns.length,
      lessons: Object.values(lessons).flat().length,
      stale: ins.stale,
      top: [
        ...topConflict.map((c) => ({ kind: "conflict" as const, ...c })),
        ...topPattern.map((x) => ({ kind: "pattern" as const, ...x, evidence: x.evidence.slice(0, 5) })),
      ],
    },
    texts: await cm.textsFor(topIds, viewer),
    lessons,
    spendUsd: cm.ledger?.total(user) ?? 0,
    limits: { spendCapUsd: cfg.spend.perUserCapUsd, pageSize: cfg.ui.pageSize },
  };
}

export const stateRoutes: Route[] = [{ method: "GET", path: "/api/state", handle: state }];
