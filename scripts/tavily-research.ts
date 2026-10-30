// DEMO-ONLY research script: asks Tavily a fixed plan of PUBLIC questions (hackathon judges' professional info and
// public profiles, sponsors and their products, the hackathon itself) and writes one markdown file per question under
// <out>/ (default ./tavily). It never touches Clearmind memory, models or embeddings: the general ingest loads the
// files later and honours each file's `visibleTo` frontmatter (judge files: [judge-<slug>], others: [workspace]).
//
// Usage:
//   tsx scripts/tavily-research.ts                      # = --dry-run: print plan + credit estimate, no network, no files
//   tsx scripts/tavily-research.ts --mock --out /tmp/x  # deterministic, clearly-labelled MOCK files (mock: true), offline
//   node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/tavily-research.ts --run [--max-credits 500]
//   options: --out <dir> (default tavily) --force (rewrite existing files) --delay-ms 400 --only judges|sponsors
// TAVILY_API_KEY is read from process.env only. Credits (Tavily docs): search basic = 1, advanced = 2.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type Depth = "basic" | "advanced";
export type Judge = { name: string; slug: string; title: string; company: string; aliases?: string[]; knownUrls?: string[]; keywords?: string[] };
type QSpec = { topic: string; question: string; query: string; depth: Depth; maxResults: number; includeDomains?: string[]; searchTopic?: "general" | "news"; fallbackQuery?: string; profileSite?: string };
export type QConfig = { judgeQuestions: QSpec[]; sponsorQuestions: QSpec[] };
export type Planned = QSpec & { id: string; path: string; group: "judges" | "sponsors"; visibleTo: string[]; judge?: Judge; credits: number; extractUrls?: string[]; fallbackCredits: number };
export type Result = { title: string; url: string; content: string; publishedDate?: string; score?: number };
export type Answer = { answer: string; results: Result[] };
export type Fetcher = (q: Planned) => Promise<Answer>;

export const COST: Record<Depth, number> = { basic: 1, advanced: 2 };
const EXTRACT_COST = (depth: Depth, n: number) => COST[depth] * Math.ceil(n / 5); // Tavily: 1 (basic) / 2 (advanced) per 5 URLs
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

export function loadInputs(dir = join(ROOT, "demo")): { judges: Judge[]; config: QConfig } {
  const judges = (JSON.parse(readFileSync(join(dir, "judges.json"), "utf8")) as { judges: Judge[] }).judges;
  const config = JSON.parse(readFileSync(join(dir, "tavily-questions.json"), "utf8")) as QConfig;
  return { judges, config };
}

export const who = (j: Judge) => `${["\"" + j.name + "\"", ...(j.aliases ?? []).map((a) => `"${a}"`)].join(" OR ")} ${j.company} ${j.title}`;
const fill = (s: string, j: Judge) => s.replace(/\{who\}/g, who(j)).replace(/\{keywords\}/g, (j.keywords?.length ? j.keywords : [j.title]).join(" "))
  .replace(/\{name\}/g, j.name).replace(/\{title\}/g, j.title).replace(/\{company\}/g, j.company);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
/** confident = some result names the judge (or an alias) AND mentions the company or a title keyword. */
export function matchOf(j: Judge, a: Answer): "confident" | "uncertain" {
  const low = (s: string) => s.toLowerCase();
  const names = [j.name, ...(j.aliases ?? [])].map(low);
  const ctx = [j.company, j.company.split(" ")[0]!, ...(j.keywords ?? []), ...j.title.split(/[ ,()]+/).filter((w) => w.length > 4)].map(low);
  return a.results.some((r) => { const b = low(`${r.title} ${r.content} ${r.url}`); return names.some((n) => b.includes(n)) && ctx.some((c) => b.includes(c)); }) ? "confident" : "uncertain";
}

export function buildPlan(judges: Judge[], cfg: QConfig, only?: "judges" | "sponsors"): Planned[] {
  const out: Planned[] = [];
  if (only !== "judges") for (const q of cfg.sponsorQuestions)
    out.push({ ...q, id: `sponsors/${q.topic}`, path: `sponsors/${q.topic}.md`, group: "sponsors", visibleTo: ["workspace"], credits: COST[q.depth], fallbackCredits: 0, fallbackQuery: undefined });
  if (only !== "sponsors") for (const j of judges) for (const q of cfg.judgeQuestions) {
    const known = q.profileSite ? (j.knownUrls ?? []).filter((u) => host(u).endsWith(q.profileSite!) || (q.profileSite === "x.com" && host(u).endsWith("twitter.com"))) : [];
    const base = { ...q, question: fill(q.question, j), id: `judges/${j.slug}/${q.topic}`, path: `judges/${j.slug}/${q.topic}.md`, group: "judges" as const, visibleTo: [`judge-${j.slug}`], judge: j };
    out.push(known.length
      ? { ...base, query: known.join(" "), extractUrls: known, credits: EXTRACT_COST("basic", known.length), fallbackQuery: undefined, fallbackCredits: 0 }
      : { ...base, query: fill(q.query, j), credits: COST[q.depth], fallbackQuery: q.fallbackQuery ? fill(q.fallbackQuery, j) : undefined, fallbackCredits: q.fallbackQuery ? COST[q.depth] : 0 });
  }
  return out;
}

export const estimate = (p: Planned[]) => p.reduce((s, q) => s + q.credits, 0);
export const worstCase = (p: Planned[]) => p.reduce((s, q) => s + q.credits + q.fallbackCredits, 0);

const y = (v: unknown) => JSON.stringify(v); // JSON scalars/arrays are valid YAML flow values
export type Meta = { fetchedAt: string; mock: boolean; credits?: number; match?: "confident" | "uncertain"; retried?: string };
export function render(q: Planned, a: Answer, meta: Meta): string {
  const fm = [
    "---", `question: ${y(q.question)}`, `query: ${y(q.query)}`, `fetchedAt: ${y(meta.fetchedAt)}`, `tool: tavily`,
    `searchDepth: ${q.depth}`, `searchTopic: ${q.searchTopic ?? "general"}`, ...(q.includeDomains ? [`includeDomains: ${y(q.includeDomains)}`] : []),
    ...(q.extractUrls ? [`mode: extract`, `extractUrls: ${y(q.extractUrls)}`] : [`mode: search`]), `creditsUsed: ${meta.mock ? 0 : meta.credits ?? q.credits}`,
    ...(meta.match ? [`match: ${meta.match}`] : []), ...(meta.retried ? [`fallbackQuery: ${y(meta.retried)}`] : []), `group: ${q.group}`, ...(q.judge ? [`subject: ${y(q.judge.name)}`, `subjectRole: ${y(`${q.judge.title}, ${q.judge.company}`)}`] : []),
    `visibleTo: ${y(q.visibleTo)}`, `mock: ${meta.mock}`, "sources:", ...a.results.map((r) => `  - ${y(r.url)}`), "---", "",
  ];
  const body = [
    `# ${q.question}`, "", meta.mock ? "> **MOCK DATA** generated offline for testing. Not real Tavily output; do not treat as fact.\n" : "",
    `Query: \`${q.query}\` (Tavily ${q.extractUrls ? "extract" : q.depth + " search"}, fetched ${meta.fetchedAt})`, meta.retried ? `\nFallback query (first pass had no clear name+company match): \`${meta.retried}\`` : "",
    meta.match === "uncertain" ? "\n> **Uncertain match:** no result clearly names this person together with the company or role; results may be about someone else.\n" : "", "", "## Answer", "", a.answer || "_Tavily returned no answer._", "",
    `## Results (${a.results.length})`, "",
    ...a.results.flatMap((r, i) => [`### ${i + 1}. ${r.title || r.url}`, "", `- URL: <${r.url}>`, ...(r.publishedDate ? [`- Published: ${r.publishedDate}`] : []),
      ...(r.score !== undefined ? [`- Score: ${r.score}`] : []), "", r.content.trim(), "", `Source: [${r.title || r.url}](${r.url})`, ""]),
  ];
  return fm.join("\n") + body.join("\n");
}

export function mockFetcher(): Fetcher {
  return async (q) => {
    const who = q.judge ? `${q.judge.name} (${q.judge.title}, ${q.judge.company})` : q.topic;
    const host = q.includeDomains?.[0] ?? "example.com";
    return {
      answer: `MOCK answer for "${q.question}". This is placeholder text about ${who}, not real data.`,
      results: [1, 2].map((n) => ({ title: `MOCK result ${n} for ${q.id}`, url: `https://${host}/mock/${q.id}/${n}`, publishedDate: n === 1 ? "2026-01-01" : undefined,
        content: q.judge && q.id.endsWith("/x") // deliberately weak for X profiles so the fallback + match: uncertain path is exercised
          ? `MOCK content ${n}: placeholder snippet with no clear identity match. Not real Tavily output.`
          : `MOCK content ${n}: placeholder snippet for query "${q.query}".${q.judge ? ` Mentions ${q.judge.name} at ${q.judge.company}.` : ""} Not real Tavily output.` })),
    };
  };
}

export function tavilyFetcher(key: string, opts: { retries?: number; baseDelayMs?: number; fetchImpl?: typeof fetch } = {}): Fetcher {
  const f = opts.fetchImpl ?? fetch, retries = opts.retries ?? 3, base = opts.baseDelayMs ?? 1000;
  return async (q) => {
    for (let attempt = 0; ; attempt++) {
      let status = 0;
      try {
        const ex = !!q.extractUrls;
        const r = await f(`https://api.tavily.com/${ex ? "extract" : "search"}`, {
          method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
          body: JSON.stringify(ex ? { urls: q.extractUrls, extract_depth: "basic" } : { query: q.query, search_depth: q.depth, topic: q.searchTopic ?? "general", max_results: q.maxResults,
            include_domains: q.includeDomains, include_answer: "basic", include_raw_content: false }),
        });
        status = r.status;
        if (r.ok) {
          const j: any = await r.json();
          if (ex) return { answer: "", results: (j.results ?? []).map((x: any) => ({ title: String(x.url ?? ""), url: String(x.url ?? ""), content: String(x.raw_content ?? "") })) };
          return { answer: String(j.answer ?? ""), results: (j.results ?? []).map((x: any) => ({ title: String(x.title ?? ""), url: String(x.url ?? ""),
            content: String(x.content ?? ""), publishedDate: x.published_date ? String(x.published_date) : undefined, score: typeof x.score === "number" ? x.score : undefined })) };
        }
      } catch { status = -1; } // network error; never echo request details (could contain the key)
      const retryable = status === -1 || status === 429 || status >= 500;
      if (!retryable || attempt >= retries) throw new Error(`tavily ${status === -1 ? "network error" : status}`);
      await sleep(base * 2 ** attempt);
    }
  };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type RunStats = { written: string[]; skipped: string[]; failed: string[]; retried: string[]; creditsUsed: number; stoppedAtCap: boolean };
export async function research(plan: Planned[], o: { outDir: string; fetcher: Fetcher; mock: boolean; maxCredits: number; force?: boolean; delayMs?: number; now?: () => string; log?: (s: string) => void }): Promise<RunStats> {
  const st: RunStats = { written: [], skipped: [], failed: [], retried: [], creditsUsed: 0, stoppedAtCap: false };
  const log = o.log ?? console.log, now = o.now ?? (() => new Date().toISOString());
  let first = true;
  for (const q of plan) {
    const file = join(o.outDir, q.path);
    if (!o.force && existsSync(file)) { st.skipped.push(q.path); continue; }
    const cost = o.mock ? 0 : q.credits;
    if (st.creditsUsed + cost > o.maxCredits) { st.stoppedAtCap = true; log(`credit cap ${o.maxCredits} reached at ${st.creditsUsed}; stopping before ${q.id}`); break; }
    if (!first && o.delayMs) await sleep(o.delayMs); // simple rate limit between questions
    first = false;
    st.creditsUsed += cost; // charged up front so a slow/failed call can never push us over the cap
    let a: Answer, spent = cost, retried: string | undefined;
    try { a = await o.fetcher(q); } catch (e) { st.failed.push(q.path); log(`  ! ${(e as Error).message} for ${q.id}`); continue; }
    let match = q.judge ? matchOf(q.judge, a) : undefined;
    const fcost = o.mock ? 0 : q.fallbackCredits;
    if (match === "uncertain" && q.fallbackQuery) {
      if (st.creditsUsed + fcost > o.maxCredits) log(`  cap: skipping fallback for ${q.id}`);
      else {
        st.creditsUsed += fcost; spent += fcost; retried = q.fallbackQuery;
        try {
          const b = await o.fetcher({ ...q, query: q.fallbackQuery });
          const seen = new Set(a.results.map((r) => r.url));
          a = matchOf(q.judge!, b) === "confident" ? b : { answer: a.answer || b.answer, results: [...a.results, ...b.results.filter((r) => !seen.has(r.url))] };
          match = matchOf(q.judge!, a); st.retried.push(q.path);
        } catch (e) { log(`  ! fallback ${(e as Error).message} for ${q.id}`); }
      }
    }
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, render(q, a, { fetchedAt: now(), mock: o.mock, credits: spent, match, retried }));
    st.written.push(q.path);
    log(`[${st.creditsUsed}/${o.maxCredits} credits] ${q.id} -> ${a.results.length} results`);
  }
  writeIndex(plan, o.outDir, o.mock);
  return st;
}

export function writeIndex(plan: Planned[], outDir: string, mock: boolean) {
  const have = plan.filter((q) => existsSync(join(outDir, q.path)));
  const line = (q: Planned) => `- [${q.question}](${q.path}) — \`${q.query}\` (${q.depth}, visibleTo ${q.visibleTo.join(", ")})`;
  const judges = [...new Set(have.filter((q) => q.judge).map((q) => q.judge!.slug))];
  const md = ["---", "tool: tavily", `mock: ${mock}`, 'visibleTo: ["admin"]', "---", "", "# Tavily research index", "",
    mock ? "> **MOCK DATA** index for testing.\n" : "", `${have.length} of ${plan.length} planned files present.`, "",
    "## Sponsors and hackathon", "", ...have.filter((q) => q.group === "sponsors").map(line), "",
    "## Judges", "", ...judges.flatMap((s) => { const qs = have.filter((q) => q.judge?.slug === s); return [`### ${qs[0]!.judge!.name}`, "", ...qs.map(line), ""]; })];
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "INDEX.md"), md.join("\n"));
}

async function main() {
  const a = process.argv.slice(2), flag = (f: string) => a.includes(f), opt = (f: string, d: string) => (a.includes(f) ? a[a.indexOf(f) + 1]! : d);
  const only = opt("--only", "") as "judges" | "sponsors" | "";
  const { judges, config } = loadInputs();
  const plan = buildPlan(judges, config, only || undefined);
  const maxCredits = Number(opt("--max-credits", "500")), outDir = opt("--out", join(ROOT, "tavily"));
  const est = estimate(plan);
  if (!flag("--mock") && !flag("--run")) {
    for (const q of plan) console.log(`${q.credits}cr ${q.depth.padEnd(8)} ${q.id.padEnd(48)} ${q.query}${q.extractUrls ? "  [extract]" : ""}${q.includeDomains ? `  [domains: ${q.includeDomains.join(",")}]` : ""}`);
    console.log(`DRY RUN: ${plan.length} questions (${plan.filter((q) => q.group === "judges").length} judge, ${plan.filter((q) => q.group === "sponsors").length} sponsor/hackathon), estimated ${est} credits first pass, up to ${worstCase(plan)} if every judge question needs its one fallback retry (cap ${maxCredits}; the run stops at the cap). Nothing fetched or written. Use --mock or --run.`);
    return;
  }
  const mock = flag("--mock");
  const key = process.env.TAVILY_API_KEY ?? "";
  if (!mock && !key) throw new Error("TAVILY_API_KEY not set (run with node --env-file=$HOME/.secrets/hackathon.env)");
  const st = await research(plan, { outDir, mock, maxCredits, force: flag("--force"), delayMs: mock ? 0 : Number(opt("--delay-ms", "400")),
    fetcher: mock ? mockFetcher() : tavilyFetcher(key) });
  console.log(JSON.stringify({ out: relative(process.cwd(), outDir) || ".", mock, written: st.written.length, retried: st.retried.length, skipped: st.skipped.length, failed: st.failed.length, creditsUsed: st.creditsUsed, cap: maxCredits, stoppedAtCap: st.stoppedAtCap }));
}
if (process.argv[1]?.endsWith("tavily-research.ts")) void main().catch((e) => { console.error((e as Error).message); process.exit(1); });
