// GET /api/graph[?scope=]: constellation nodes, or per-scope clusters for large memories.
import type { Route } from "./types.js";

export const graphRoutes: Route[] = [
  {
    method: "GET",
    path: "/api/graph",
    handle: ({ cm, query, viewer }) => cm.graph({ scope: query.get("scope") ?? undefined, viewer }),
  },
];
