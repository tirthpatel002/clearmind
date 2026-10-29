// Clearmind checkpoint-1 demo: supersession + access policy, end to end, offline (BM25 recall, no API calls).
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clearmind, fmtLog, fmtMemory } from "@clearmind/core";

const dir = process.argv[2] ?? mkdtempSync(join(tmpdir(), "clearmind-demo-"));
const cm = new Clearmind({ dir, ownerId: "tirth" });
const step = (s: string) => console.log(`\n== ${s}`);

step("1. remember");
const v1 = await cm.remember("Tirth's team standup is at 10:00 IST on weekdays", { tags: ["work"], key: "standup-time" });
await cm.remember("Tirth is allergic to peanuts", { tags: ["health"] });
console.log(fmtMemory(v1));

step("2. update (old version is marked replaced)");
const v2 = await cm.update(v1.id, "Tirth's team standup moved to 11:30 IST on weekdays");
console.log(fmtMemory(v2));
for (const m of await cm.history(v2.id)) console.log("  history: " + fmtMemory(m));

step("3. recall: newest wins");
for (const m of await cm.recall("when is the team standup")) console.log(fmtMemory(m));

step("4. owner grants agent-b scope #work for purpose 'schedule-meetings' (consent by tirth, 60 min)");
const g = cm.grant({ agentId: "agent-b", tags: ["work"], purposes: ["schedule-meetings"], consentBy: "tirth", ttlMs: 60 * 60_000 });
console.log(`${g.grantId} expires ${g.expiresAt}`);

const show = async (label: string, req: Parameters<Clearmind["read"]>[0]) => {
  step(label);
  const r = await cm.read(req);
  console.log(`${r.decision.toUpperCase()}: ${r.reason}`);
  for (const m of r.memories) console.log("  " + fmtMemory(m));
};
await show("5. agent-b reads WITHOUT a purpose", { agentId: "agent-b", query: "standup time" });
await show("6. agent-b reads with purpose + scope #work", { agentId: "agent-b", purpose: "schedule-meetings", tags: ["work"], query: "standup time" });
await show("7. agent-b tries scope #health", { agentId: "agent-b", purpose: "schedule-meetings", tags: ["health"], query: "allergies" });

step("8. tirth revokes the grant");
console.log(`${g.grantId} revokedAt ${cm.revoke(g.grantId, "tirth").revokedAt}`);
await show("9. agent-b reads again", { agentId: "agent-b", purpose: "schedule-meetings", tags: ["work"], query: "standup time" });

step("10. access log");
for (const e of cm.accessLog()) console.log(fmtLog(e));
await cm.close();
console.log(`\n(data dir: ${dir})`);
