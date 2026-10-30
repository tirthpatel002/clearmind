// All authenticated API routes, matched in order.
import { accessRoutes } from "./access.js";
import { graphRoutes } from "./graph.js";
import { importRoutes } from "./import.js";
import { insightRoutes } from "./insights.js";
import { memoryRoutes } from "./memories.js";
import { stateRoutes } from "./state.js";
import { demoRoutes } from "./demo.js";
import { reflectRoutes } from "./demo-reflect.js";
import { entityRoutes } from "./entities.js";
import { streamRoutes } from "./stream.js";
import type { Route } from "./types.js";

export type { Route, RouteContext } from "./types.js";

export const routes: Route[] = [
  ...stateRoutes,
  ...memoryRoutes,
  ...entityRoutes,
  ...accessRoutes,
  ...insightRoutes,
  ...graphRoutes,
  ...importRoutes,
  ...demoRoutes,
  ...reflectRoutes,
  ...streamRoutes,
];

/** Find the route for a request; returns it with the captured path groups. */
export function matchRoute(method: string, path: string): { route: Route; params: string[] } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (typeof route.path === "string") {
      if (route.path === path) return { route, params: [] };
      continue;
    }
    const m = path.match(route.path);
    if (m) return { route, params: m.slice(1) };
  }
  return null;
}
