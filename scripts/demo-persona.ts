// Deterministic FICTIONAL persona for the hackathon demo: "Maya Iyer", a product designer in Pune.
// No real personal data: every name, place, number and address below is invented (emails use example.com).
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/demo-persona.ts <dataDir> [user]
//        add --dry to print the dataset without ingesting.
import { join } from "node:path";
import { Clearmind, loadConfig, nebiusEmbedder, SpendLedger } from "@clearmind/core";

export interface Item { at: string; text: string; tags: string[]; key?: string }

/** Small seeded PRNG (mulberry32) so the dataset is identical on every run. */
function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const START = Date.UTC(2026, 8, 14); // 14 Sep 2026
const DAYS = 46; // to 29 Oct 2026

export function persona(): Item[] {
  const r = rng(20261030);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const out: Item[] = [];
  const at = (d: number, h: number, m = 0) => new Date(START + d * 86400e3 + (h * 60 + m - 330) * 60e3).toISOString(); // IST wall time
  const add = (d: number, h: number, text: string, tags: string[], key?: string) => out.push({ at: at(d, h, Math.floor(r() * 50)), text, tags, ...(key ? { key } : {}) });

  // ---- stable profile facts (day 0) ----
  add(0, 9, "Maya Iyer is a senior product designer at Lumen Labs in Pune", ["work"], "role");
  add(0, 9, "Maya's manager at Lumen Labs is Arjun Mehta", ["work"], "manager");
  add(0, 9, "Design team standup is at 10:00 IST on weekdays", ["work"], "standup");
  add(0, 10, "Maya lives in a flat in Baner, Pune with her partner Kabir", ["home"], "home");
  add(0, 10, "Maya is vegetarian and avoids mushrooms", ["food"], "diet");
  add(0, 10, "Maya's gym is Iron Lotus Fitness in Baner, membership renews monthly", ["health"], "gym");
  add(0, 11, "Maya's younger brother Rohan studies mechanical engineering in Bengaluru", ["family"]);
  add(0, 11, "Maya's mother Lata lives in Nashik and calls every Sunday evening", ["family"]);
  add(0, 12, "Maya is learning acoustic guitar from online lessons, currently on barre chords", ["hobby"]);
  add(0, 12, "Maya's dentist is Dr. Kavita Rao at Smile Studio Aundh: call +91 98765 43210 or email appointments@smilestudio.example.com", ["health"], "dentist");
  add(1, 9, "Maya's favourite cafe for focused work is Paper Boat Cafe on Baner Road", ["food"]);
  add(1, 9, "Maya prefers design reviews in the morning and keeps Friday afternoons meeting-free", ["work"], "meeting-pref");
  add(2, 18, "Maya's sister-in-law Neha's birthday is on 21 October", ["family"]);
  add(3, 20, "Kabir is allergic to cashews, so Maya avoids cashew curries when cooking for both", ["food", "home"]);

  // ---- daily life over ~6.5 weeks ----
  const breakfasts = ["poha with peanuts", "masala oats", "idli and coconut chutney", "upma", "besan chilla", "fruit bowl with yogurt", "thalipeeth", "toast with peanut butter", "sabudana khichdi", "paratha with curd"];
  const lunches = ["dal khichdi", "rajma chawal", "a paneer wrap", "curd rice", "veg biryani", "a quinoa salad", "chole with jeera rice", "a millet bowl", "pav bhaji", "a thali at the office canteen"];
  const dinners = ["palak paneer and rotis", "a homemade pasta in tomato sauce", "vegetable pulao", "dosa from Vaishali", "a Thai green curry with tofu", "methi thepla", "baingan bharta", "misal pav", "veg hakka noodles", "aloo gobi with dal"];
  const workouts = ["a 5 km run along the Baner hill trail", "a strength session: squats and deadlifts", "a 40 minute yoga class", "a 30 minute HIIT circuit", "an upper body session at the gym", "a 7 km easy run", "a swim of 1 km at the community pool", "a long walk of 8000 steps", "a mobility and stretching session", "a cycling session of 15 km"];
  const projects = ["the Atlas onboarding redesign", "the checkout flow for the Kite app", "the design system colour tokens", "the dashboard empty states", "the mobile settings screen", "the accessibility audit", "the pricing page experiment", "the notification preferences flow"];
  const workEvents = [
    (p: string) => `Presented ${p} to the product team and got feedback to simplify the first step`,
    (p: string) => `Ran two usability tests on ${p}; both users missed the secondary button`,
    (p: string) => `Finished high-fidelity mockups for ${p} in Figma`,
    (p: string) => `Paired with the frontend engineer Sana on ${p} handoff specs`,
    (p: string) => `Wrote the research summary for ${p}`,
    (p: string) => `Reviewed analytics for ${p}: drop-off is highest on the second screen`,
    (p: string) => `Had a 1:1 about ${p} timelines; target is end of the month`,
    (p: string) => `Sketched three alternative layouts for ${p}`,
  ];
  const books = ["The Design of Everyday Things", "Shoe Dog", "Klara and the Sun", "Atomic Habits", "The Ministry for the Future", "Sapiens"];
  const errands = ["paid the electricity bill of Rs 2,340", "picked up dry cleaning from the shop near Balewadi", "renewed the broadband plan for 6 months", "bought groceries at the Saturday market in Aundh", "booked a plumber for the kitchen tap", "returned a pair of running shoes that were too small", "ordered a new desk lamp", "topped up the metro card", "got the scooter serviced at the Baner garage", "bought a gift for Neha's birthday"];
  const guitar = ["practised the F barre chord for 20 minutes", "learned the strumming pattern for a slow ballad", "practised chord changes between G, C and D", "recorded a short practice clip to check timing", "worked on fingerpicking exercises", "restrung the guitar with new light-gauge strings"];
  const commutes = ["took the metro to the office, 25 minutes", "rode the scooter to work; heavy traffic near the university circle", "worked from home today", "shared a cab with Sana to the office", "cycled to the office, 6 km"];
  const snacks = ["masala chai and a banana", "roasted makhana", "a handful of almonds", "filter coffee and a biscuit", "sprouts chaat", "a cold coffee from the office pantry"];
  const evenings = ["watched an episode of a Korean drama with Kabir", "went for a walk in the society garden", "cleaned up the balcony plants", "called a college friend, Tanvi", "planned meals for the week", "sorted photos from the summer trip", "practised sketching for 30 minutes"];
  const moods = ["slept 7.5 hours and felt rested", "slept badly, about 5 hours", "had a mild headache in the afternoon", "felt energetic after the morning workout", "felt tired after a long day of meetings"];

  for (let d = 1; d < DAYS; d++) {
    const dow = new Date(START + d * 86400e3).getUTCDay(); // 0 Sun
    const weekend = dow === 0 || dow === 6;
    const lbl = new Date(START + d * 86400e3).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).replace(",", "");
    add(d, 8, `${lbl}: Breakfast: ${pick(breakfasts)}`, ["food"]);
    if (r() < 0.7) add(d, 7, `${lbl}: Workout: ${pick(workouts)}`, ["health"]);
    if (!weekend) {
      const p = pick(projects);
      add(d, 11, `${lbl}: ${pick(workEvents)(p)}`, ["work"]);
      if (r() < 0.6) add(d, 15, `${lbl}: ${pick(workEvents)(pick(projects))}`, ["work"]);
      add(d, 13, `${lbl}: Lunch: ${pick(lunches)}`, ["food"]);
      add(d, 9, `${lbl}: Commute: ${pick(commutes)}`, ["work"]);
      if (r() < 0.6) add(d, 16, `${lbl}: Snack: ${pick(snacks)}`, ["food"]);
    } else {
      add(d, 11, `${lbl}: Errand: ${pick(errands)}`, ["home"]);
      if (r() < 0.6) add(d, 16, `${lbl}: Guitar: ${pick(guitar)}`, ["hobby"]);
    }
    add(d, 20, `${lbl}: Dinner: ${pick(dinners)}`, ["food"]);
    if (r() < 0.7) add(d, 21, `${lbl}: Evening: ${pick(evenings)}`, ["home"]);
    if (r() < 0.45) add(d, 22, `${lbl}: Reading ${pick(books)}, about ${10 + Math.floor(r() * 40)} pages tonight`, ["hobby"]);
    if (r() < 0.5) add(d, 23, `${lbl}: Sleep and mood: ${pick(moods)}`, ["health"]);
    if (dow === 0) add(d, 19, `${lbl}: Sunday call with mother Lata; she asked about ${pick(["Diwali plans", "Rohan's exams", "the new flat", "Maya's health", "the Nashik visit"])}`, ["family"]);
  }

  // ---- plans and one-off events ----
  add(5, 14, "Booked a trip to Goa with Kabir for 14 to 17 November", ["travel"], "goa-trip");
  add(6, 10, "Goa stay is at Casa Verde, a guesthouse in Assagao", ["travel"]);
  add(9, 18, "Flight to Goa on 14 November departs Pune at 07:40", ["travel"], "goa-flight");
  add(12, 9, "Annual health check booked for 4 November at 08:30 at Sahyadri Clinic", ["health"], "health-check");
  add(15, 19, "Rohan is visiting Pune on the weekend of 25 October", ["family"]);
  add(18, 12, "Lumen Labs quarterly offsite is on 6 November at Lonavala", ["work"]);
  add(20, 20, "Maya and Kabir are hosting a small Diwali dinner for six friends on 8 November", ["home", "family"]);
  add(23, 9, "Monthly budget target: keep food delivery under Rs 4,000", ["home"], "budget");

  // ---- changed facts (same key supersedes the older memory) ----
  add(19, 17, "Arjun Mehta moved to another team; Maya's new manager is Priya Nair", ["work"], "manager");
  add(26, 9, "Design team standup moved to 11:15 IST on weekdays from 12 October", ["work"], "standup");
  add(30, 18, "Maya switched gyms to Pulse Athletic Club in Balewadi; cancelled Iron Lotus", ["health"], "gym");
  add(33, 21, "Goa flight was rescheduled: it now departs Pune at 10:55 on 14 November", ["travel"], "goa-flight");
  add(37, 13, "Maya now eats fish occasionally (pescatarian), still avoids mushrooms", ["food"], "diet");
  add(40, 9, "Maya was promoted to lead product designer at Lumen Labs", ["work"], "role");
  return out;
}

async function main() {
  const [dir, user = "maya"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const items = persona();
  if (process.argv.includes("--dry") || !dir) {
    for (const i of items) console.log(i.at, i.key ?? "-", i.text);
    console.log(`${items.length} items`);
    return;
  }
  const cfg = loadConfig({ overrides: { dataDir: dir } });
  const ledger = new SpendLedger(join(dir, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
  let now = new Date(items[0]!.at);
  const cm = Clearmind.fromEnv(dir, user, { config: cfg, ledger, now: () => now });
  const embed = nebiusEmbedder(ledger, cfg, user) as unknown as (t: string[]) => Promise<Float32Array[]>;
  const sorted = [...items].sort((a, b) => (a.at < b.at ? -1 : 1));
  const vecs: Float32Array[] = [];
  for (let i = 0; i < sorted.length; i += 64) vecs.push(...(await embed(sorted.slice(i, i + 64).map((x) => x.text))).map((v) => Float32Array.from(v)));
  let confirmed = 0, superseded = 0;
  for (const [i, it] of sorted.entries()) {
    now = new Date(it.at);
    const m = await cm.remember(it.text, { tags: it.tags, key: it.key, embedding: vecs[i] });
    if (m.confirmed) confirmed++;
    if (m.supersedes.length) superseded++;
  }
  const st = await cm.stats();
  console.log(JSON.stringify({ items: sorted.length, active: st.active, replaced: st.replaced, confirmedDuplicates: confirmed, superseded, spendUsd: ledger.total(user), embedCalls: Math.ceil(sorted.length / 64) }));
  await cm.close();
}
if (process.argv[1]?.endsWith("demo-persona.ts")) void main();
