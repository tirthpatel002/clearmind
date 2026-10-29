// Seed realistic demo data spread over the last 14 days (backdated clock). Normal rules (patterns need >=2 distinct days).
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/seed.ts <dataDir>
import { existsSync, rmSync } from "node:fs";
import { Clearmind } from "../src/clearmind.js";

const dir = process.argv[2];
if (!dir) throw new Error("usage: seed.ts <dataDir>");
if (existsSync(dir)) rmSync(dir, { recursive: true });
let clock = new Date();
const cm = Clearmind.fromEnv(dir, "tirth", { now: () => clock });
const at = (daysAgo: number, hh: number, mm = 0) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm, 0, 0); clock = d; };

const seed: [number, number, string, string[], string?][] = [
  [14, 9, "Tirth works as a software engineer on the payments team", ["work"], "role"],
  [14, 9, "Team standup is at 10:00 IST on weekdays", ["work"], "standup"],
  [13, 20, "Ordered paneer tikka from Spice Hub for dinner", ["food"]],
  [12, 8, "Morning coffee: oat milk flat white from Third Wave", ["food"]],
  [11, 19, "Tirth is allergic to peanuts", ["health"], "allergy"],
  [10, 21, "Late-night paneer tikka order from Spice Hub, extra mint chutney", ["food"]],
  [9, 8, "Oat milk flat white from Third Wave, usual order", ["food"]],
  [8, 7, "Went to the gym for a 5 km run", ["health"]],
  [7, 11, "Sister Riya's birthday is on November 14", ["family"], "riya-bday"],
  [6, 20, "Friday: paneer tikka with garlic naan from Spice Hub", ["food"]],
  [5, 7, "Gym session: 5 km run and stretching", ["health"]],
  [4, 15, "Tirth's flight to Delhi on Nov 3 departs at 18:30", ["travel"]],
  [3, 8, "Grabbed an oat milk flat white at Third Wave on the way to office", ["food"]],
  [2, 10, "Prefers meetings after 11:00 IST, no meetings on Friday afternoons", ["work"], "meeting-pref"],
  [1, 18, "Airline email: Tirth's flight to Delhi on Nov 3 departs at 21:00", ["travel"]],
  [1, 7, "Gym again: 5 km run, legs day", ["health"]],
];
for (const [d, h, text, tags, key] of seed) { at(d, h); await cm.remember(text, { tags, key }); }

// Owner confirmed the allergy a few days later (confidence rises).
at(4, 9); await cm.remember("Tirth is allergic to peanuts.", { tags: ["health"] });

// A past failed agent run -> lesson distilled by Nemotron.
at(3, 16);
const run = await cm.startRun("calendar-agent", "schedule a sync with Tirth's team");
await cm.record("calendar-agent", run, { type: "tool_call", tool: "calendar.create", input: { time: "10:00", tz: "UTC" } });
await cm.record("calendar-agent", run, { type: "error", error: "Invite sent for 10:00 UTC; team works in IST, so the slot was 15:30 IST and clashed" });
const ls = await cm.endRun("calendar-agent", run, { status: "fail", failureType: "false_done", reason: "booked in wrong timezone" });

clock = new Date();
const pats = await cm.titledPatterns(); // default rules: minSupport 3, minDays 2
console.log(`seeded ${(await cm.list()).length} memories, ${(await cm.conflicts()).length} conflicts, ${pats.length} patterns, ${ls.length} lessons; spend $${cm.ledger!.total().toFixed(5)}`);
for (const p of pats) console.log(`  pattern: "${p.title}" ${p.label} support=${p.support} days=${p.distinctDays} terms=${p.terms.join(",")}`);
await cm.close();
