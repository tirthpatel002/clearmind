// Deterministic FICTIONAL persona v3 for the hackathon demo: "Maya Iyer", lead product designer in Pune.
// Rich RAW events only: journal notes, meeting notes, chats with Clearmind, web-agent run logs, emails and
// security-relevant events. No insight, habit or lesson is written here: Clearmind's reflect step must derive them.
// Every name, place, number, key and address is invented (emails/domains use .example).
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/demo-persona-v3.ts <dataDir> [user] [--dry]
import { join } from "node:path";
import { Clearmind, loadConfig, nebiusEmbedder, SpendLedger } from "@clearmind/core";

export interface Item { at: string; text: string; tags: string[]; key?: string }

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const START = Date.UTC(2026, 8, 14); // Mon 14 Sep 2026
const DAYS = 46; // to Thu 29 Oct 2026
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function persona(): Item[] {
  const r = rng(20261030);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const out: Item[] = [];
  const dt = (d: number) => new Date(START + d * 86400e3);
  const dow = (d: number) => dt(d).getUTCDay();
  const label = (d: number) => `${WD[dow(d)]} ${dt(d).getUTCDate()} ${MON[dt(d).getUTCMonth()]}`;
  const at = (d: number, h: number, m: number) => new Date(START + d * 86400e3 + (h * 60 + m - 330) * 60e3).toISOString(); // IST
  const hm = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const add = (d: number, h: number, m: number, text: string, tags: string[], key?: string) => out.push({ at: at(d, h, m), text, tags, ...(key ? { key } : {}) });
  const jitter = (n: number) => Math.floor(r() * n);

  // ---------------- profile and changed facts ----------------
  add(0, 9, 10, "Profile note: Maya Iyer is a product designer at Lumen Labs in Pune, working on the Kite payments app. She lives in Baner with her partner Kabir, who is a backend engineer at a logistics startup. Her manager is Arjun Mehta.", ["profile"], "manager");
  add(0, 9, 20, "Team calendar: the design team standup is at 10:00 IST on weekdays in the 'Loft' room or on the team call.", ["work"], "standup");
  add(0, 9, 30, "Maya's dentist is Dr. Kavita Rao at Smile Studio Aundh: call +91 98765 43210 or email appointments@smilestudio.example.com. Next cleaning is due in December.", ["health", "contacts"]);
  add(1, 20, 5, "Gym membership: Maya trains at Iron Lotus Fitness in Baner, usually before work.", ["health"], "gym");
  add(2, 13, 0, "Food note: Maya is vegetarian and avoids mushrooms; Kabir eats everything.", ["food"], "diet");
  add(19, 17, 41, "Org update from the all-hands: Arjun Mehta is moving to the Payments Platform team. From Monday Maya reports to Priya Nair, the new design manager, who joined from a fintech in Bengaluru.", ["work"], "manager");
  add(26, 9, 5, "Calendar change: the design team standup moved from 10:00 to 11:15 IST on weekdays starting 12 October, because Priya has a leadership sync at 10.", ["work"], "standup");
  add(30, 18, 20, "Maya switched gyms to Pulse Athletic Club in Balewadi (it has a badminton court and is closer to the office) and cancelled Iron Lotus.", ["health"], "gym");
  add(37, 13, 30, "Food note: Maya has started eating fish occasionally (pescatarian now) but still avoids mushrooms.", ["food"], "diet");
  add(40, 9, 0, "Promotion: Maya was promoted to lead product designer at Lumen Labs, effective 26 October. She now owns the Kite design roadmap.", ["work"], "role");
  add(1, 21, 0, "Trip plan: Maya and Kabir are going to Goa from 14 to 17 November and staying at Casa Verde, a guesthouse in Assagao.", ["travel"]);

  // ---------------- daily life (raw journal notes) ----------------
  const breakfasts = ["poha with peanuts", "idli and coconut chutney", "upma", "masala oats", "two parathas with curd", "fruit bowl and toast"];
  const lunches = ["dal rice at the office canteen", "a paneer wrap from the cafe downstairs", "leftover rajma chawal", "a salad bowl from Green Leaf", "thali at Shreyas"];
  const fridayDinner = ["Malaka Spice", "Malaka Spice", "Barometer", "Malaka Spice", "the Irani cafe near Baner road"];
  for (let d = 0; d < DAYS; d++) {
    const w = dow(d), wk = Math.floor(d / 7);
    const parts: string[] = [];
    if (w >= 1 && w <= 5) {
      if (r() < 0.75) parts.push(`Woke at 6:${30 + jitter(20)} and did ${pick(["a 5 km run along the Baner hill road", "45 minutes of yoga at home", "a strength session at the gym", "a brisk walk with a podcast"])}.`);
      parts.push(`Breakfast was ${pick(breakfasts)}; lunch was ${pick(lunches)}.`);
    }
    // Friday evening: badminton most weeks (one week skipped for the offsite prep, one for a late review)
    if (w === 5 && wk !== 2 && wk !== 5) {
      const h = 19, m = 20 + jitter(25);
      parts.push(`Around ${hm(h, m)} played badminton with Kabir and Sana at the Baner Sports Arena for about an hour (${pick(["won two of three games", "lost a close game to Sana", "worked on backhand clears", "Kabir finally beat her"])}), then dinner at ${pick(fridayDinner)}.`);
    } else if (w === 5) parts.push("Stayed late at the office for a design review, so no badminton tonight; ordered dinner in.");
    // Sunday: farmers market and meal prep
    if (w === 0 && wk !== 3) parts.push(`Sunday morning around 8:${10 + jitter(30)}: went to the Aundh farmers market for vegetables (${pick(["methi, bhindi and tomatoes", "spinach, carrots and guavas", "cauliflower, peas and bananas", "brinjal, coriander and papaya"])}) and then meal-prepped lunches for the week.`);
    if (w === 6) parts.push(`Saturday: ${pick(["sketching at the Pune Okayama garden", "a long brunch with college friends at Koregaon Park", "cleaned the flat and watered the plants", "visited Kabir's parents in Kothrud", "read Shoe Dog for two hours"])}.`);
    if (w >= 1 && w <= 4 && r() < 0.5) parts.push(`Evening: ${pick(["watched an episode of a Korean drama", "called Amma for half an hour", "practised sketching for 30 minutes", "cooked khichdi with Kabir", "went for a walk in the society garden"])}.`);
    add(d, 22, 10 + jitter(30), `Journal, ${label(d)}: ${parts.join(" ")}`, ["journal"]);
  }

  // ---------------- meetings (notes with people and projects) ----------------
  const projects = [
    { p: "Kite checkout redesign", people: "Sana (frontend), Rohit (PM)", items: ["Decided to move the UPI option above cards.", "Usability tests showed 3 of 5 users missed the secondary button.", "Agreed to ship the new address form behind a flag."] },
    { p: "Kite accessibility audit", people: "Neha (QA), Priya", items: ["Contrast on the amount field fails WCAG AA; Maya will fix the tokens.", "Screen reader labels are missing on the OTP inputs.", "Target: AA on all payment screens by mid-November."] },
    { p: "design system colour tokens", people: "Sana, Vikram (design ops)", items: ["Renamed 40 tokens to the semantic scheme.", "Dark mode palette approved with one change to the warning colour.", "Figma library publish scheduled for Thursday."] },
  ];
  for (let d = 0; d < DAYS; d++) {
    const w = dow(d); if (w < 1 || w > 5 || r() < 0.45) continue;
    const pr = pick(projects);
    add(d, 15, jitter(50), `Meeting notes, ${label(d)}, ${pr.p} with ${pr.people}: ${pick(pr.items)} ${pick(pr.items)} Action items: Maya to ${pick(["update the Figma prototype", "write the decision in the design log", "share a Loom walkthrough", "book a follow-up review"])} by ${pick(["Friday", "Monday", "end of week"])}.`, ["work", "meeting"]);
  }

  // ---------------- chats with Clearmind (usage events) ----------------
  for (let d = 0; d < DAYS; d++) {
    const w = dow(d);
    if (w >= 1 && w <= 5 && r() < 0.8) add(d, 8, 35 + jitter(20), `Chat with Clearmind (phone), ${label(d)}: Maya asked "what's on my calendar today?" and Clearmind listed ${2 + jitter(4)} meetings${w === 5 ? " plus badminton in the evening" : ""}.`, ["usage", "chat"]);
    if (w >= 1 && w <= 5 && r() < 0.5) add(d, 11, 5 + jitter(8), `Chat with Clearmind (laptop), ${label(d)}: Maya asked "draft my standup update" and got three bullet points from yesterday's notes.`, ["usage", "chat"]);
    if (w === 0) add(d, 20, 20 + jitter(25), `Chat with Clearmind (laptop), ${label(d)}: Maya asked "plan meals for the week and make a grocery list" and then asked the grocery agent to order it.`, ["usage", "chat"]);
  }

  // ---------------- web-agent run logs ----------------
  let runNo = 400;
  const run = (d: number, h: number, m: number, task: string, site: string, outcome: string, mins: number, steps: string[], extra: string) => {
    runNo++;
    add(d, h, m, `Agent run R-${runNo} | task: ${task} | site: ${site} | started: ${label(d)} ${hm(h, m)} IST | outcome: ${outcome} | duration: ${mins} min | steps: ${steps.map((s, i) => `${i + 1}) ${s}`).join(" ")} | ${extra}`, ["agent-run", task]);
  };
  // Weekly grocery order (Sundays after meal planning) on FreshCart
  const gOK = ["open freshcart.example", "restore saved session", "search each item on the list", "add items to cart", "apply the weekly coupon", "choose the 8-10 am slot", "pay with saved UPI", "confirm order"];
  for (const d of [6, 13, 20, 27]) run(d, 20, 50, "grocery-order", "freshcart.example", "success", 6 + jitter(3), gOK, `notes: ${18 + jitter(8)} items, delivered next morning.`);
  run(34, 20, 55, "grocery-order", "freshcart.example", "failed", 9, ["open freshcart.example", "saved session expired", "log in with stored password", "login rejected (attempt 1)", "login rejected (attempt 2)", "login rejected (attempt 3)", "site asks for an SMS OTP"], "error: OTP required after 3 failed login attempts; agent has no OTP channel | retries: 3 | notes: the stored password was out of date after a site-forced reset.");
  run(36, 18, 10, "grocery-order", "freshcart.example", "failed", 4, ["open freshcart.example", "log in with stored password", "site asks for an SMS OTP immediately"], "error: OTP required after 3 failed login attempts; account is in a 24 h lock | retries: 1 | notes: Maya ordered from the shop downstairs instead.");
  run(38, 19, 0, "grocery-order", "freshcart.example", "success", 7, ["open freshcart.example", "log in with the updated password", "request SMS OTP", "read OTP from the forwarded SMS relay", "add items to cart", "choose slot", "pay with saved UPI", "confirm order"], "fix: Maya updated the stored password and enabled the SMS OTP relay; login retries capped at 1 so the account is not locked again | notes: 21 items.");
  run(41, 20, 40, "grocery-order", "freshcart.example", "success", 6, gOK, "notes: 17 items; session restored without OTP.");
  // Weekly expense filing on ClaimDesk (Fridays)
  const manual = ["open claimdesk.example", "log in", "open new claim", "upload receipt 1", "type amount and category", "upload receipt 2", "type amount and category", "upload receipt 3", "type amount and category", "upload receipt 4", "type amount and category", "add project code", "attach manager approval", "submit"];
  run(4, 17, 30, "expense-filing", "claimdesk.example", "success", 12, manual, "notes: 4 receipts entered one by one.");
  run(11, 17, 40, "expense-filing", "claimdesk.example", "failed", 9, manual.slice(0, 8), "error: session expired during receipt upload (15 min idle timeout) | retries: 0 | notes: draft lost.");
  run(11, 18, 10, "expense-filing", "claimdesk.example", "success", 13, manual, "notes: redone from scratch after the timeout.");
  run(18, 17, 25, "expense-filing", "claimdesk.example", "success", 3, ["open claimdesk.example", "log in", "Import > 'Gmail receipts' label (bulk)", "review auto-filled amounts and categories", "add project code", "submit"], "fix: switched from typing each receipt to the bulk import from the Gmail 'receipts' label | notes: 6 receipts in one go.");
  for (const d of [25, 32, 39]) run(d, 17, 20 + jitter(20), "expense-filing", "claimdesk.example", "success", 2 + jitter(2), ["open claimdesk.example", "log in", "Import > 'Gmail receipts' label (bulk)", "review auto-filled amounts and categories", "add project code", "submit"], `notes: ${3 + jitter(5)} receipts.`);
  // Flight booking and reschedule on SkyLeaf
  run(5, 21, 15, "flight-booking", "skyleaf.example", "success", 11, ["open skyleaf.example", "search PNQ to GOI on 14 Nov", "filter morning departures", "pick the 07:40 flight", "add Kabir as second passenger", "select seats 12A and 12B", "pay with credit card", "save e-ticket to Drive"], "notes: booking reference SKL-7Q2M (fictional).");
  run(33, 21, 30, "flight-booking", "skyleaf.example", "success", 6, ["open skyleaf.example", "open manage booking SKL-7Q2M", "accept the schedule change to 10:55", "re-select seats 12A and 12B", "save updated e-ticket"], "notes: airline moved the flight; no fare difference.");
  // Subscription renewal (Sketchpad Pro)
  run(17, 10, 5, "subscription-renewal", "sketchpad.example", "failed", 3, ["open sketchpad.example/billing", "click renew annual plan", "payment declined"], "error: card declined because the saved card ending 4242 has expired | retries: 1");
  run(18, 9, 40, "subscription-renewal", "sketchpad.example", "success", 4, ["open sketchpad.example/billing", "replace the card with the new card ending 7319", "click renew annual plan", "download invoice"], "fix: updated the expired card before renewing | notes: Rs 9,600 for a year.");

  // ---------------- emails and security-relevant events (raw) ----------------
  add(5, 22, 40, "Chat with Clearmind (laptop): Maya said \"remember my FreshCart login, the password is Monsoon#2026\" so the grocery agent can sign in.", ["chat", "accounts"]);
  add(9, 19, 30, "Chat with Clearmind (laptop): Maya said \"use the same password for ClaimDesk, password Monsoon#2026, I don't want another one to remember\".", ["chat", "accounts"]);
  add(22, 16, 12, "Chat with Clearmind (laptop): while debugging the Kite staging build Maya pasted: \"here is the staging payments key sk_" + "live_FAKE9f3a2c7d1e5b8a6c4d2e0f, can you check why the webhook fails?\"", ["chat", "work"]);
  add(25, 3, 12, "Email from Lumen Workspace Security (no-reply@lumenlabs.example): \"New sign-in to maya.iyer@lumenlabs.example from Minsk, Belarus on Windows / Chrome at 03:12 IST. If this wasn't you, reset your password.\" Maya was asleep in Pune at the time.", ["email", "accounts"]);
  add(29, 10, 2, "Email from 'Lumen Labs Payroll' <payroll@lumenlabs-payroll.example.top>: \"Your October salary is on hold. Verify your bank details within 24 hours at http://lumenlabs-payroll.verify-account.example.top/login\".", ["email"]);
  add(37, 9, 48, "Email from 'HR Lumen Labs' <hr-desk@lumen-labs-hr.example.top>: \"Action required: confirm your bank account for the Diwali bonus at http://lumenlabs-payroll.verify-account.example.top/login\".", ["email"]);
  add(31, 21, 5, "Installed the 'TabGenie' browser extension to summarise tabs; it asked for permission to read and change all data on all websites and to read and send Gmail, and Maya clicked Allow.", ["apps", "accounts"]);
  add(12, 14, 0, "Email from Pune Metro: your metro card was topped up with Rs 500 (receipt attached).", ["email"]);
  add(20, 18, 30, "Maya and Kabir are hosting a small Diwali dinner for six friends on 8 November; Kabir is making biryani.", ["home"]);
  add(18, 12, 0, "Lumen Labs quarterly offsite is on 6 November at Lonavala; bus leaves the office at 8:00.", ["work"]);
  return out;
}

async function main() {
  const [dir, user = "maya"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const items = persona();
  if (process.argv.includes("--dry") || !dir) {
    for (const i of items) console.log(i.at, i.key ?? "-", i.text);
    console.log(`${items.length} items, ${Math.round(items.reduce((a, i) => a + i.text.length, 0) / items.length)} chars avg`);
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
if (process.argv[1]?.endsWith("demo-persona-v3.ts")) void main();
