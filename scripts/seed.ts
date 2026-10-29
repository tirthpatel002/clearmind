// Seed realistic demo data spread over the last 14 days (backdated clock). Normal rules (patterns need >=2 distinct days).
// The app itself ships with NO data; this script is the only way demo data gets in, and only with --demo.
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/seed.ts --demo --dir <dataDir> --user <id> [--name "Display name"]
//        (pnpm seed --demo --dir ... --user ...). Wipes <dataDir> first.
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clearmind, loadConfig, validUserId } from "@clearmind/core";

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
if (!process.argv.includes("--demo")) { console.error("refusing to seed: pass --demo explicitly (demo data is never added automatically)"); process.exit(2); }
const dir = arg("dir"), user = arg("user"); const NAME = arg("name") ?? user ?? "";
if (!dir || !validUserId(user)) { console.error("usage: seed.ts --demo --dir <dataDir> --user <id> [--name Name]"); process.exit(2); }
if (existsSync(dir)) rmSync(dir, { recursive: true });
let clock = new Date();
const cfg = loadConfig({ overrides: { dataDir: dir } });
const cm = Clearmind.fromEnv(dir, user, { now: () => clock, config: cfg });
const N = (s: string) => s.replaceAll("{name}", NAME);
const at = (daysAgo: number, hh: number, mm = 0) => { const d = new Date(); d.setDate(d.getDate() - daysAgo); d.setHours(hh, mm, 0, 0); clock = d; };

const seed: [number, number, string, string[], string?][] = [
  [14, 9, "{name} works as a software engineer on the payments team", ["work"], "role"],
  [14, 9, "Team standup is at 10:00 IST on weekdays", ["work"], "standup"],
  [13, 20, "Ordered paneer tikka from Spice Hub for dinner", ["food"]],
  [12, 8, "Morning coffee: oat milk flat white from Third Wave", ["food"]],
  [11, 19, "{name} is allergic to peanuts", ["health"], "allergy"],
  [10, 21, "Late-night paneer tikka order from Spice Hub, extra mint chutney", ["food"]],
  [9, 8, "Oat milk flat white from Third Wave, usual order", ["food"]],
  [8, 7, "Went to the gym for a 5 km run", ["health"]],
  [7, 11, "Sister Riya's birthday is on November 14", ["family"], "riya-bday"],
  [6, 20, "Friday: paneer tikka with garlic naan from Spice Hub", ["food"]],
  [5, 7, "Gym session: 5 km run and stretching", ["health"]],
  [4, 15, "{name}'s flight to Delhi on Nov 3 departs at 18:30", ["travel"]],
  [3, 8, "Grabbed an oat milk flat white at Third Wave on the way to office", ["food"]],
  [2, 10, "Prefers meetings after 11:00 IST, no meetings on Friday afternoons", ["work"], "meeting-pref"],
  [1, 18, "Airline email: {name}'s flight to Delhi on Nov 3 departs at 21:00", ["travel"]],
  [1, 7, "Gym again: 5 km run, legs day", ["health"]],
];
for (const [d, h, text, tags, key] of seed) { at(d, h); await cm.remember(N(text), { tags, key }); }

// Owner confirmed the allergy a few days later (confidence rises).
at(4, 9); await cm.remember(N("{name} is allergic to peanuts."), { tags: ["health"] });

// A past failed agent run -> lesson distilled by Nemotron.
at(3, 16);
const run = await cm.startRun("calendar-agent", N("schedule a sync with {name}'s team"));
await cm.record("calendar-agent", run, { type: "tool_call", tool: "calendar.create", input: { time: "10:00", tz: "UTC" } });
await cm.record("calendar-agent", run, { type: "error", error: "Invite sent for 10:00 UTC; team works in IST, so the slot was 15:30 IST and clashed" });
const ls = await cm.endRun("calendar-agent", run, { status: "fail", failureType: "false_done", reason: "booked in wrong timezone" });

clock = new Date();
for (const a of ["calendar-agent", "shopping-agent"]) cm.addAgent(a);
const pats = await cm.titledPatterns();
await cm.insights({ wait: true });
writeFileSync(join(dir, "demo.json"), JSON.stringify({ user, seededAt: new Date().toISOString() })); // default rules: minSupport 3, minDays 2
console.log(`seeded ${(await cm.list()).length} memories, ${(await cm.conflicts()).length} conflicts, ${pats.length} patterns, ${ls.length} lessons; spend $${cm.ledger!.total().toFixed(5)}`);
for (const p of pats) console.log(`  pattern: "${p.title}" ${p.label} support=${p.support} days=${p.distinctDays} terms=${p.terms.join(",")}`);
await cm.close();
