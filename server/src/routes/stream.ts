// SSE batched delivery for display lists (see sendSse): events meta {total}, batch {items}, done, error {message}.
// Visibility is applied before batching, so totals and items are per viewer. Search and recall never read these.
import { SseReply } from "../http.js";
import { graphCached } from "./demo-reflect.js";
import type { Route } from "./types.js";

export const STREAM_BATCH = 100;
function* chunks<T>(xs: T[], extra: Record<string, unknown> = {}) { for (let i = 0; i < xs.length; i += STREAM_BATCH) yield { ...extra, items: xs.slice(i, i + STREAM_BATCH) }; }

export const streamRoutes: Route[] = [
  { method: "GET", path: "/api/stream/memories", handle: ({ cm, viewer, query: q }) => {
    const status = (q.get("status") as "active" | "all" | null) ?? "active", scope = q.get("scope") ?? undefined;
    return new SseReply(
      async () => ({ total: (await cm.page({ limit: 1, viewer, status, scope })).total ?? 0 }),
      async function* () {
        let cursor: string | null = null;
        do { const p = await cm.page({ limit: STREAM_BATCH, cursor, viewer, status, scope }); if (p.items.length) yield { items: p.items }; cursor = p.nextCursor; } while (cursor);
      },
    );
  } },
  { method: "GET", path: "/api/stream/entities", handle: ({ cm, viewer }) => {
    let all: unknown[] | null = null;
    const load = async () => (all ??= (await cm.entityList({ limit: 1_000_000, offset: 0 }, viewer)).entities as unknown[]);
    return new SseReply(async () => ({ total: (await load()).length }), async function* () { yield* chunks(await load()); });
  } },
  { method: "GET", path: "/api/stream/graph", handle: ({ cfg, user, cm, viewer }) => {
    let g: any = null;
    const load = async () => (g ??= await graphCached(cfg, user, cm, viewer));
    return new SseReply(
      async () => { const x = await load(); return { total: x.nodes.length, nodes: x.nodes.length, edges: (x.edges ?? []).length, counts: x.counts, entities: x.entities }; },
      async function* () { const x = await load(); yield* chunks(x.nodes, { kind: "node" }); yield* chunks(x.edges ?? [], { kind: "edge" }); },
    );
  } },
];
