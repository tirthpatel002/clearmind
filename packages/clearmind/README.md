# @clearmind/core

The Clearmind memory layer as a library: memory store and recall, the access policy, the learning layer,
calibrated abstention, config, and pluggable model providers. It has no HTTP or UI code; the server and the
web app depend on it, never the other way round.

```ts
import { Clearmind, loadConfig } from "@clearmind/core";

const cfg = loadConfig();
const cm = Clearmind.fromEnv(cfg.dataDir, "alex", { config: cfg }); // offline unless the API key env var is set
await cm.remember("Team standup is at 10:00 IST", { tags: ["work"], key: "standup" });
cm.grant({ agentId: "calendar-agent", tags: ["work"], purposes: ["schedule-meetings"], consentBy: "alex" });
const r = await cm.read({ agentId: "calendar-agent", purpose: "schedule-meetings", query: "standup" });
await cm.close();
```

| File | What it does |
|---|---|
| `src/index.ts` | Public API |
| `src/store.ts` | `Clearmind`: one user's memories (remember, correct, confirm, recall, paging, stats, insights, graph, ask) |
| `src/policy.ts` | Grants, consent, purposes, scopes, expiry, revoke and the access log (SQLite) |
| `src/learning.ts` | Confidence decay, duplicates, conflicts, patterns (pure functions) |
| `src/abstain.ts` | Answerability score and the "not in memory" answer |
| `src/config.ts` | Defaults < JSON file < `CLEARMIND_*` env vars; secrets are rejected from the file |
| `src/types.ts` | Shared data and HTTP API types (no runtime code; safe for the browser) |
| `src/providers/` | `ModelProvider` interface and the Nebius Token Factory implementation |
| `src/spend.ts` | Spend ledger with global and per-user caps |
| `src/importer.ts`, `src/titles.ts`, `src/prompts.ts`, `src/scopes.ts`, `src/format.ts`, `src/cli.ts` | Helpers |

To add a provider, implement `ModelProvider` (`chat`, `llm`, `embedder`) and pass its parts to `new Clearmind({ ... })`.

Tests: `pnpm --filter @clearmind/core test`.
