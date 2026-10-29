// Checkpoint-2 demo: learning memory + Nemotron ask + hybrid recall (live Nebius). Run with node --env-file.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clearmind } from "../src/clearmind.js";
import { fmtLog, fmtMemory } from "../src/cli.js";

const dir = process.argv[2] ?? mkdtempSync(join(tmpdir(), "clearmind-cp2-"));
const cm = Clearmind.fromEnv(dir, "tirth");
const step = (s: string) => console.log(`\n== ${s}`);
const askShow = async (q: string, req: Parameters<Clearmind["ask"]>[1] = {}) => {
  const r = await cm.ask(q, req);
  console.log(`Q: ${q}  [agent=${req.agentId ?? "owner"} purpose=${req.purpose ?? "-"}]`);
  console.log(`A: ${r.answer}`);
  if (r.usage) console.log(`   (${r.usage.model}, ${r.usage.promptTokens}+${r.usage.completionTokens} tok, $${r.usage.usd.toFixed(5)}, ${r.usage.ms} ms; cited ${r.cited.join(",") || "-"})`);
};

step("remember (embedded with Qwen3-Embedding-8B)");
const s1 = await cm.remember("Team standup is at 10:00 IST on weekdays", { tags: ["work"], key: "standup" });
await cm.remember("Tirth's flight to Delhi on Nov 3 departs at 18:30", { tags: ["travel"] });
await cm.remember("Tirth's flight to Delhi on Nov 3 departs at 21:00", { tags: ["travel"] });
for (const t of ["Ordered paneer tikka from Spice Hub for dinner", "Ordered paneer tikka from Spice Hub again", "Paneer tikka from Spice Hub delivered for Friday dinner"])
  await cm.remember(t, { tags: ["food"] });
await cm.remember("Tirth is allergic to peanuts", { tags: ["health"] });
for (const m of await cm.list()) console.log(fmtMemory(m));

step("update -> old version replaced");
const s2 = await cm.update(s1.id, "Team standup moved to 11:30 IST on weekdays");
for (const m of await cm.history(s2.id)) console.log("  " + fmtMemory(m));

step("confirm by repeating a fact (confidence rises)");
console.log(fmtMemory(await cm.remember("Tirth is allergic to peanuts.", { tags: ["health"] })));

step("conflicts");
for (const c of await cm.conflicts()) console.log(`CONFLICT ${c.a} <> ${c.b}: ${c.reason} (sim ${c.similarity})`);

step("patterns (repeated facts, with evidence; minDays=1 because this demo writes everything today)");
for (const p of await cm.patterns({ minDays: 1 })) console.log(`${p.label} support=${p.support} confidence=${p.confidence} evidence=${p.evidence.join(",")}`);

step("agent lesson distilled by Nemotron from a failed agent run");
const run = await cm.startRun("agent-b", "schedule a sync with Tirth's team");
await cm.record("agent-b", run, { type: "tool_call", tool: "calendar.create", input: { time: "10:00", tz: "UTC" } });
await cm.record("agent-b", run, { type: "error", error: "Invite sent for 10:00 UTC; team works in IST and standup is 11:30 IST, so the slot clashed" });
const lessons = await cm.endRun("agent-b", run, { status: "fail", failureType: "false_done", reason: "booked in wrong timezone" });
for (const l of lessons) console.log(`${l.lessonId} [${l.status} ${l.kind}] ${l.text} (when: ${l.trigger})`);

step("ask (Nemotron answers from memory; hybrid recall threshold 0.5)");
await askShow("When is the team standup?");
cm.grant({ agentId: "agent-b", tags: ["work"], purposes: ["schedule-meetings"], consentBy: "tirth", ttlMs: 3600_000 });
await askShow("When is the team standup?", { agentId: "agent-b" });
await askShow("When is the team standup?", { agentId: "agent-b", purpose: "schedule-meetings" });
await askShow("Is Tirth allergic to anything?", { agentId: "agent-b", purpose: "schedule-meetings", tags: ["health"] });

step("access log");
for (const e of cm.accessLog()) console.log(fmtLog(e));
console.log(`\nNebius spend this demo: $${cm.ledger!.total().toFixed(5)}  (data dir ${dir})`);
await cm.close();
