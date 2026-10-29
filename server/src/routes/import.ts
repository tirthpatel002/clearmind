// Bringing memories in: bulk import (text/JSON/CSV) and fact extraction from a chat transcript.
import type { Route } from "./types.js";

export const importRoutes: Route[] = [
  {
    method: "POST",
    path: "/api/import",
    handle: async ({ cm, cfg, body, useModel }) => {
      const b = await body(cfg.import.maxBytes + 10_000);
      useModel();
      return cm.importMemories(String(b.data ?? ""), b.format, { defaultScope: b.scope || undefined });
    },
  },
  {
    method: "POST",
    path: "/api/extract",
    handle: async ({ cm, body, useModel }) => {
      const b = await body(50_000);
      useModel();
      return { facts: await cm.extract(String(b.text ?? "")) };
    },
  },
];
