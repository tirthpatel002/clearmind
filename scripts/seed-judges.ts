// DEMO-ONLY seeder: gathers PUBLIC web data about the hackathon judges, their companies and products via Tavily,
// and ingests it into a Clearmind data dir as source-linked "web" memories plus entities (people, orgs, products).
// It is not part of Clearmind's runtime and nothing in the app calls it. No logins, no scraping: only Tavily search
// results (title, URL, snippet). Every memory keeps its URL, title and fetched-at date; Nemotron may condense a
// snippet, but a summary that introduces a number not in the snippet is discarded in favour of the cleaned snippet.
//
// Usage (dataDir should be a COPY that already holds the demo persona, e.g. a copy of demo-data-v3):
//   node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/seed-judges.ts <dataDir> [--user maya]
//        [--max-credits 300] [--dry-run] [--mock] [--smoke] [--no-summarize] [--judges-only] [--topics-only]
//   --dry-run   print the planned Tavily queries and the estimated credits; no network calls, nothing written
//   --mock      canned offline responses (no Tavily, no Nemotron, no embeddings), for testing into a scratch dir
//   --smoke     one basic Tavily query (1 credit) to validate the request shape; prints result titles only
//   --max-credits  stop cleanly before a call would exceed this many Tavily credits (default 300)
// Entity types (person, org, product), field names (role, organization, notable, profiles, topics) and predicates
// (works at, makes) are chosen HERE, as data; Clearmind core has no built-in types, fields or predicates.
// Credits (Tavily docs): search basic = 1, advanced = 2; extract basic = 1 per 5 URLs, advanced = 2 per 5 (not used).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clearmind, loadConfig, nebiusChat, nebiusEmbedder, SpendLedger } from "@clearmind/core";

type Co = "NVIDIA" | "Nebius" | "Tavily";
const JUDGES: [string, string, Co][] = [
  ["Nancy Agarwal", "Senior Software Engineer", "NVIDIA"], ["Abhinav Balasubramanian", "Staff AI Engineer", "NVIDIA"],
  ["Dylan Bristot", "Founding PMM, Nebius Token Factory", "Nebius"], ["AbdulMajed Raja", "Developer Relations Lead (Token Factory) - APJ", "Nebius"],
  ["Rob Spectre", "Developer Relations Advisor", "Nebius"], ["Evan Rimer", "Forward Deployed Engineer", "Tavily"],
  ["Lakshmi Rameish", "Senior System Software Engineer", "NVIDIA"], ["Surbhi Jha", "Senior Software Engineer", "NVIDIA"],
  ["Joe Sarabia", "Director of Product, Ecosystem", "Nebius"], ["Marouane Khoukh", "Technical Developer Advocate", "Nebius"],
  ["Ricky Johnson", "Developer Relations", "Tavily"], ["Selena Williams", "System Software Engineer", "NVIDIA"],
  ["Aleksandr Patrushev", "Head of Product Management, ML/AI", "Nebius"], ["Unmesh Kurup", "Chief ML Researcher, Product", "Nebius"],
  ["Daniel Myers", "Director of Developer Relations", "Nebius"], ["Jacquie Capur", "Senior Developer Advocate", "Nebius"],
  ["Lakshya Prakash Agarwal", "Forward Deployed Engineer", "Tavily"], ["Johnny Nunez", "AI Developer Advocate - Physical AI & Robotics", "NVIDIA"],
  ["Evan Helda", "Head of GTM Physical AI", "Nebius"], ["Mikhail Rozhkov", "Technical Product Manager - Serverless AI", "Nebius"],
  ["Dhruv Diddi", "Principal - Physical AI Ecosystem", "Nebius"], ["Aditya Sahu", "TME, Jetson Platform", "NVIDIA"],
  ["Sayali Kandarkar", "Senior AI/ML Engineer", "NVIDIA"],
];
// [query, depth, topic, entity it is about, entity type, maker]
type Topic = { q: string; depth: "basic" | "advanced"; topic?: "general" | "news"; about: string; type: "org" | "product"; maker?: Co; must: string[] };
const TOPICS: Topic[] = [
  { q: "Nebius Token Factory inference platform open models", depth: "advanced", about: "Nebius Token Factory", type: "product", maker: "Nebius", must: ["Token Factory"] },
  { q: "Nebius AI Cloud GPU infrastructure", depth: "advanced", about: "Nebius AI Cloud", type: "product", maker: "Nebius", must: ["Nebius"] },
  { q: "Nebius Token Factory models pricing per million tokens", depth: "advanced", about: "Nebius Token Factory", type: "product", maker: "Nebius", must: ["Nebius"] },
  { q: "Nemotron models hosted on Nebius Token Factory", depth: "advanced", about: "Nemotron", type: "product", maker: "NVIDIA", must: ["Nemotron", "Nebius"] },
  { q: "Nebius news 2026", depth: "basic", topic: "news", about: "Nebius", type: "org", must: ["Nebius"] },
  { q: "NVIDIA Nemotron open models family", depth: "advanced", about: "Nemotron", type: "product", maker: "NVIDIA", must: ["Nemotron"] },
  { q: "NVIDIA open models open weights datasets", depth: "basic", about: "NVIDIA", type: "org", must: ["NVIDIA"] },
  { q: "NVIDIA Jetson Orin Nano edge AI developer kit", depth: "advanced", about: "Jetson", type: "product", maker: "NVIDIA", must: ["Jetson"] },
  { q: "NVIDIA NIM inference microservices", depth: "advanced", about: "NVIDIA NIM", type: "product", maker: "NVIDIA", must: ["NIM"] },
  { q: "Tavily search extract crawl API for AI agents", depth: "advanced", about: "Tavily API", type: "product", maker: "Tavily", must: ["Tavily"] },
  { q: "using Tavily web search in LLM agents", depth: "basic", about: "Tavily", type: "org", must: ["Tavily"] },
];
const PROFILE_DOMAINS = ["linkedin.com", "x.com", "twitter.com", "github.com"];
const COST = { basic: 1, advanced: 2 } as const;

type Hit = { title: string; url: string; content: string };
type Call = { q: string; depth: "basic" | "advanced"; topic?: "general" | "news"; include_domains?: string[]; max_results: number };
const plan = (judgesOnly: boolean, topicsOnly: boolean): { call: Call; for: { kind: "topic"; t: Topic } | { kind: "judge" | "profile"; j: (typeof JUDGES)[number] } }[] => [
  ...(judgesOnly ? [] : TOPICS.map((t) => ({ call: { q: t.q, depth: t.depth, topic: t.topic ?? "general", max_results: 5 }, for: { kind: "topic" as const, t } }))),
  ...(topicsOnly ? [] : JUDGES.flatMap((j) => [
    { call: { q: `"${j[0]}" ${j[2]} ${j[1]}`, depth: "basic" as const, max_results: 5 }, for: { kind: "judge" as const, j } },
    { call: { q: `"${j[0]}" ${j[2]}`, depth: "basic" as const, include_domains: PROFILE_DOMAINS, max_results: 5 }, for: { kind: "profile" as const, j } },
  ])),
];

class Budget {
  used = 0;
  constructor(readonly max: number) {}
  take(n: number): boolean { if (this.used + n > this.max) return false; this.used += n; return true; }
}
async function tavily(c: Call, key: string): Promise<Hit[]> {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: c.q, search_depth: c.depth, topic: c.topic ?? "general", max_results: c.max_results, include_domains: c.include_domains, include_answer: false, include_raw_content: false }),
  });
  if (!r.ok) throw new Error(`tavily ${r.status}`); // never echo headers or body (could contain the key)
  const j: any = await r.json();
  return (j.results ?? []).map((x: any) => ({ title: String(x.title ?? ""), url: String(x.url ?? ""), content: String(x.content ?? "") }));
}
function mockHits(c: Call, f: ReturnType<typeof plan>[number]["for"]): Hit[] {
  if (f.kind === "topic") return [{ title: `${f.t.about} overview`, url: `https://example.com/${encodeURIComponent(f.t.about)}`, content: `${f.t.about} is offered by ${f.t.maker ?? f.t.about}. (mock snippet for ${f.t.must.join(", ")}; ${c.q})` }];
  const [n, title, co] = f.j;
  if (f.kind === "profile") return [{ title: `${n} - ${title} - ${co} | LinkedIn`, url: `https://www.linkedin.com/in/${n.toLowerCase().replace(/\W+/g, "-")}-mock`, content: `${n}. ${title} at ${co}. (mock profile headline)` }];
  return [{ title: `${n} talk`, url: `https://example.com/talks/${encodeURIComponent(n)}`, content: `${n}, ${title} at ${co}, spoke about developer tooling. (mock snippet)` }, { title: `Unrelated ${n.split(" ")[0]}`, url: "https://example.com/other", content: "An ambiguous page without the company name." }];
}

const has = (s: string, w: string) => s.toLowerCase().includes(w.toLowerCase());
const clean = (s: string) => s.replace(/\s+/g, " ").replace(/[#*_`>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 700);
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
const jacc = (a: Set<string>, b: Set<string>) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / Math.max(1, a.size + b.size - i); };
const profileKind = (url: string): "linkedin" | "x" | "github" | null => {
  try {
    const u = new URL(url), h = u.hostname.replace(/^www\.|^[a-z]{2}\./, "");
    if (h === "linkedin.com" && /^\/in\/[^/]+\/?$/.test(u.pathname)) return "linkedin";
    if ((h === "x.com" || h === "twitter.com") && /^\/[A-Za-z0-9_]{1,15}\/?$/.test(u.pathname)) return "x";
    if (h === "github.com" && /^\/[A-Za-z0-9-]+\/?$/.test(u.pathname)) return "github";
  } catch { /* bad url */ }
  return null;
};
/** Only keep a summary whose numbers all appear in the source snippet; otherwise use the snippet itself. */
function faithful(summary: string, snippet: string): boolean {
  const nums = summary.match(/\d[\d.,]*/g) ?? [];
  return summary.length > 40 && nums.every((n) => snippet.includes(n.replace(/[.,]$/, "")));
}

async function main() {
  const a = process.argv.slice(2), flag = (f: string) => a.includes(f), opt = (f: string, d: string) => (a.includes(f) ? a[a.indexOf(f) + 1]! : d);
  const dir = a.find((x, i) => !x.startsWith("--") && !a[i - 1]?.match(/^--(user|max-credits)$/));
  const user = opt("--user", "maya"), budget = new Budget(Number(opt("--max-credits", "300")));
  const calls = plan(flag("--judges-only"), flag("--topics-only"));
  const est = calls.reduce((s, c) => s + COST[c.call.depth], 0);
  if (flag("--dry-run")) {
    for (const c of calls) console.log(`${COST[c.call.depth]}cr ${c.call.depth.padEnd(8)} ${c.for.kind.padEnd(7)} ${c.call.q}${c.call.include_domains ? `  [domains: ${c.call.include_domains.join(",")}]` : ""}`);
    console.log(`${calls.length} Tavily search calls, estimated ${est} credits (cap ${budget.max}). Extract: not used (0 credits).`);
    return;
  }
  const key = process.env.TAVILY_API_KEY ?? "";
  if (flag("--smoke")) {
    if (!key) throw new Error("TAVILY_API_KEY not set (load ~/.secrets/hackathon.env with node --env-file)");
    const hits = await tavily({ q: "Nebius Token Factory", depth: "basic", max_results: 2 }, key);
    console.log(`smoke ok: 1 credit, ${hits.length} results`, hits.map((h) => `${h.title} <${h.url}>`));
    return;
  }
  if (!dir) throw new Error("usage: seed-judges.ts <dataDir> [--user maya] [--max-credits 300] [--dry-run|--mock|--smoke]");
  const mock = flag("--mock");
  if (!mock && !key) throw new Error("TAVILY_API_KEY not set (load ~/.secrets/hackathon.env with node --env-file)");
  const cfg = loadConfig({ overrides: { dataDir: dir } });
  const ledger = new SpendLedger(join(dir, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
  const cm = Clearmind.fromEnv(dir, user, { config: cfg, ledger, offline: mock });
  const chat = mock || flag("--no-summarize") ? null : nebiusChat(ledger, cfg, user);
  const embed = mock ? null : (nebiusEmbedder(ledger, cfg, user) as unknown as (t: string[]) => Promise<Float32Array[]>);
  const fetchedAt = new Date().toISOString().slice(0, 10);
  const spend0 = ledger.total(user); // the dir may already hold earlier spend
  const E = cm.entities;
  const orgs = Object.fromEntries((["NVIDIA", "Nebius", "Tavily"] as Co[]).map((c) => [c, E.upsert(c, "org", c === "Nebius" ? ["Nebius AI", "Nebius B.V."] : c === "NVIDIA" ? ["Nvidia", "NVIDIA Corporation"] : ["Tavily AI"])]));
  const report: Record<string, { results: number; kept: number; profiles: Record<string, string>; skipped: string[] }> = {};
  type Item = { text: string; tags: string[]; ents: string[]; url: string; title: string };
  const items: Item[] = [], seenUrl = new Set<string>(), seenWords: Set<string>[] = [];
  const keep = (it: Item): boolean => {
    const w = words(it.text);
    if (seenUrl.has(it.url) || seenWords.some((s) => jacc(s, w) > 0.8)) return false;
    seenUrl.add(it.url); seenWords.push(w); items.push(it); return true;
  };
  const EMBED_MODEL = mock ? "none (mock)" : cfg.nebius.embedModel, CHAT_MODEL = cfg.nebius.chatModel;
  const st = { nemotronCalls: 0, accepted: 0, rejected: 0, chatUsd: 0, tavilyCalls: 0 };
  const prov = (h: Hit, by: string) => `(Source: ${h.title}, ${h.url}, fetched ${fetchedAt} via Tavily; enriched by ${by}; embedded with ${EMBED_MODEL} on Nebius Token Factory.)`;
  const summarize = async (subject: string, h: Hit): Promise<{ body: string; by: string }> => {
    const raw = await summarize0(subject, h);
    return raw;
  };
  const summarize0 = async (subject: string, h: Hit): Promise<{ body: string; by: string }> => {
    const snip = clean(h.content);
    const verbatim = { body: snip, by: chat ? `the Tavily snippet verbatim (${CHAT_MODEL} summary rejected by the faithfulness check)` : "the Tavily snippet verbatim (no model)" };
    if (!chat) return verbatim;
    try {
      const r = await chat([
        { role: "system", content: "Rewrite the web snippet as 2-4 factual sentences about the subject. Use ONLY facts stated in the snippet; no new numbers, dates or claims. Plain text." },
        { role: "user", content: `Subject: ${subject}\nTitle: ${h.title}\nSnippet: ${snip}` },
      ], { maxTokens: 220 });
      st.nemotronCalls++; st.chatUsd += r.usd;
      const s = r.content.replace(/\s+/g, " ").trim();
      if (faithful(s, snip + " " + h.title)) { st.accepted++; return { body: s, by: `${r.model} on Nebius Token Factory` }; }
      st.rejected++; return verbatim;
    } catch { return verbatim; }
  };

  let stopped = false;
  for (const c of calls) {
    if (!budget.take(COST[c.call.depth])) { console.log(`credit cap ${budget.max} reached at ${budget.used}; stopping cleanly`); stopped = true; break; }
    let hits: Hit[];
    try { hits = mock ? mockHits(c.call, c.for) : await tavily(c.call, key); } catch (e) { console.log(`  ! ${(e as Error).message} for: ${c.call.q}`); continue; }
    st.tavilyCalls++;
    console.log(`[${budget.used}/${budget.max} credits] ${c.for.kind} ${c.call.q} -> ${hits.length}`);
    const f = c.for;
    if (f.kind === "topic") {
      const ent = f.t.type === "org" ? orgs[f.t.about as Co] ?? E.upsert(f.t.about, "org") : E.upsert(f.t.about, "product");
      if (f.t.maker) E.relate(orgs[f.t.maker]!.id, "makes", ent.id, { sources: hits.map((h) => h.url), confidence: 0.9 });
      for (const h of hits) {
        const blob = `${h.title} ${h.content}`;
        if (!f.t.must.every((m) => has(blob, m))) continue;
        const sm = await summarize(f.t.about, h);
        keep({ text: `${f.t.about}: ${sm.body} ${prov(h, sm.by)}`, tags: ["web", "tavily", f.t.about.toLowerCase().replace(/\W+/g, "-")], ents: [ent.id, ...(f.t.maker ? [orgs[f.t.maker]!.id] : [])], url: h.url, title: h.title });
      }
      continue;
    }
    const [name, title, co] = f.j;
    const r = (report[name] ??= { results: 0, kept: 0, profiles: {}, skipped: [] });
    r.results += hits.length;
    const person = E.upsert(name, "person");
    E.relate(person.id, "works at", orgs[co]!.id, { sources: ["https://nebiusglobalaihackathon.devpost.com/"], confidence: 0.95 });
    const devpost = { sources: ["https://nebiusglobalaihackathon.devpost.com/"], fetchedAt };
    E.setField(person.id, "role", title, devpost); E.setField(person.id, "organization", co, devpost);
    E.setField(person.id, "notable", "Judge, Nebius x NVIDIA Global AI Hackathon (2026)", devpost);
    for (const h of hits) {
      const blob = `${h.title} ${h.content}`;
      const nameOk = has(blob, name), coOk = has(blob, co) || (co === "Nebius" && has(blob, "Token Factory"));
      if (f.kind === "profile") {
        const k = profileKind(h.url);
        const titleOk = title.split(/[ ,-]+/).filter((w) => w.length > 4).some((w) => has(blob, w));
        if (!k || !nameOk || !(coOk || titleOk)) { r.skipped.push(`${k ?? "non-profile"} ${h.url} (${!nameOk ? "name" : "company/title"} not matched)`); continue; }
        if (r.profiles[k]) continue;
        r.profiles[k] = h.url;
        const head = clean(h.content).slice(0, 300);
        keep({ text: `${name}'s public ${k === "x" ? "X" : k === "github" ? "GitHub" : "LinkedIn"} profile (${h.url}) is titled "${h.title}". ${head} ${prov(h, "the Tavily snippet verbatim (profile headline)")}`, tags: ["web", "tavily", "judge", co.toLowerCase()], ents: [person.id, orgs[co]!.id], url: h.url, title: h.title });
        continue;
      }
      if (!nameOk || !coOk) { r.skipped.push(`${h.url} (${!nameOk ? "name" : "company"} not in content)`); continue; }
      const sm = await summarize(`${name} (${title}, ${co})`, h);
      if (keep({ text: `${name}, ${title} at ${co}: ${sm.body} ${prov(h, sm.by)}`, tags: ["web", "tavily", "judge", co.toLowerCase()], ents: [person.id, orgs[co]!.id], url: h.url, title: h.title })) r.kept++;
    }
    if (f.kind === "profile") { const pf: Record<string, string> = { ...r.profiles }; if (Object.keys(pf).length) E.setField(person.id, "profiles", pf, { sources: Object.values(pf), fetchedAt }); }
  }

  const vecs: (Float32Array | undefined)[] = [];
  if (embed) for (let i = 0; i < items.length; i += 64) vecs.push(...(await embed(items.slice(i, i + 64).map((x) => x.text))).map((v) => Float32Array.from(v)));
  let n = 0;
  for (const [i, it] of items.entries()) {
    const m = await cm.remember(it.text, { tags: it.tags, embedding: vecs[i] });
    for (const id of it.ents) E.link(m.id, id, "about", 0.9);
    await cm.linkEntities(m.id, it.text, { sources: [it.url], fetchedAt });
    n++;
  }
  // per-person summary field from kept memories (provenance = their URLs and memory ids)
  for (const [name] of JUDGES) {
    const p = E.resolve(name); if (!p) continue;
    const ms = items.filter((x) => x.ents.includes(p.id));
    if (ms.length) E.setField(p.id, "topics", [...new Set(ms.flatMap((x) => x.tags).filter((t) => !["web", "tavily", "judge"].includes(t)))], { sources: ms.map((x) => x.url), fetchedAt });
  }
  const embedded = await cm.embedEntities();
  console.log("\nper-judge profiles:");
  for (const [name] of JUDGES) { const r = report[name]; if (r) console.log(`  ${name}: kept ${r.kept}/${r.results}; profiles ${Object.entries(r.profiles).map(([k, v]) => `${k}=${v}`).join(" ") || "none found"}; skipped ${r.skipped.length}`); }
  const total = ledger.total(user) - spend0;
  const manifest = { demoOnly: true, at: new Date().toISOString(), user, mock,
    tavily: { searchCalls: st.tavilyCalls, credits: budget.used, cap: budget.max, stoppedAtCap: stopped },
    enrichment: { model: chat ? CHAT_MODEL : null, calls: st.nemotronCalls, accepted: st.accepted, rejectedAsUnfaithful: st.rejected, usd: +st.chatUsd.toFixed(4) },
    embeddings: { model: EMBED_MODEL, memories: embed ? n : 0, entities: embedded, usd: +Math.max(0, total - st.chatUsd).toFixed(4) },
    memories: n, entities: E.counts(), judges: Object.fromEntries(Object.entries(report).map(([k, v]) => [k, { kept: v.kept, profiles: v.profiles }])) };
  writeFileSync(join(dir, "demo-seed.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ memories: n, creditsUsed: budget.used, cap: budget.max, stoppedAtCap: stopped, entitiesEmbedded: embedded, entities: E.counts(), spendUsd: +(ledger.total(user) - spend0).toFixed(4) }));
  await cm.close();
}
if (process.argv[1]?.endsWith("seed-judges.ts")) void main().catch((e) => { console.error((e as Error).message); process.exit(1); });
