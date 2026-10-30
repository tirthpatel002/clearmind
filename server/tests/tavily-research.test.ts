import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildPlan, estimate, loadInputs, matchOf, mockFetcher, research, tavilyFetcher, worstCase, type Planned } from "../../scripts/tavily-research.js";

const { judges, config } = loadInputs();
const plan = buildPlan(judges, config);
const dirs: string[] = [];
const tmp = () => { const d = mkdtempSync(join(tmpdir(), "tavily-")); dirs.push(d); return d; };
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }); });
const fm = (s: string) => s.split("---")[1]!;
const quiet = () => {};

describe("tavily-research (offline)", () => {
  it("dry-run plan: count and credit estimate", () => {
    expect(judges).toHaveLength(23);
    expect(plan).toHaveLength(23 * config.judgeQuestions.length + config.sponsorQuestions.length);
    expect(estimate(plan)).toBe(plan.reduce((s, q) => s + (q.depth === "advanced" ? 2 : 1), 0));
    expect(estimate(plan)).toBeLessThanOrEqual(300);
    expect(worstCase(plan)).toBe(estimate(plan) + 23 * config.judgeQuestions.length);
    const bg = plan.find((q) => q.id === "judges/dylan-bristot/background")!;
    expect(bg.query).toContain('"Dylan Bristot"'); expect(bg.query).toContain("Nebius Token Factory"); expect(bg.query).toContain("Founding PMM");
    expect(bg.fallbackQuery).toBe('"Dylan Bristot" PMM');
    for (const t of ["background", "linkedin", "x", "github", "talks", "writing", "projects", "views"]) expect(plan.filter((q) => q.id.endsWith(`/${t}`))).toHaveLength(23);
  });

  it("mock run writes the full tree with correct frontmatter and visibility", async () => {
    const out = tmp();
    const st = await research(plan, { outDir: out, fetcher: mockFetcher(), mock: true, maxCredits: 300, log: quiet, now: () => "2026-10-30T00:00:00Z" });
    expect(st.written).toHaveLength(plan.length);
    expect(existsSync(join(out, "INDEX.md"))).toBe(true);
    expect(readdirSync(join(out, "judges"))).toHaveLength(23);
    const nancy = readFileSync(join(out, "judges/nancy-agarwal/linkedin.md"), "utf8");
    expect(fm(nancy)).toContain('visibleTo: ["judge-nancy-agarwal"]');
    expect(fm(nancy)).toMatch(/mock: true/); expect(fm(nancy)).toMatch(/tool: tavily/); expect(fm(nancy)).toMatch(/question: /);
    expect(fm(nancy)).toMatch(/searchDepth: basic/); expect(fm(nancy)).toMatch(/creditsUsed: 0/); expect(fm(nancy)).toContain("  - \"https://linkedin.com/mock/");
    expect(nancy).toContain("MOCK DATA"); expect(nancy).toContain("Published: 2026-01-01");
    for (const q of plan) {
      const f = fm(readFileSync(join(out, q.path), "utf8"));
      expect(f).toContain(`visibleTo: ${JSON.stringify(q.group === "judges" ? [`judge-${q.judge!.slug}`] : ["workspace"])}`);
    }
    expect(fm(nancy)).toMatch(/match: confident/);
    const x = readFileSync(join(out, "judges/nancy-agarwal/x.md"), "utf8");
    expect(fm(x)).toMatch(/match: uncertain/); expect(fm(x)).toContain("fallbackQuery:"); expect(x).toContain("Uncertain match");
    expect(st.retried).toHaveLength(23);
    expect(fm(readFileSync(join(out, "sponsors/token-factory-models.md"), "utf8"))).toMatch(/searchDepth: advanced/);
  });

  it("credit cap stops early without exceeding it", async () => {
    const out = tmp(); let calls = 0;
    const f = mockFetcher(), fetcher = async (q: Planned) => { calls++; return f(q); };
    const st = await research(plan, { outDir: out, fetcher, mock: false, maxCredits: 10, log: quiet });
    expect(st.stoppedAtCap).toBe(true);
    expect(st.creditsUsed).toBeLessThanOrEqual(10);
    expect(calls).toBe(st.written.length);
    expect(st.written.length).toBeLessThan(plan.length);
  });

  it("is idempotent: existing files are skipped unless force", async () => {
    const out = tmp(); let calls = 0;
    const f = mockFetcher(), fetcher = async (q: Planned) => { calls++; return f(q); };
    await research(plan, { outDir: out, fetcher, mock: true, maxCredits: 300, log: quiet });
    calls = 0;
    const again = await research(plan, { outDir: out, fetcher, mock: false, maxCredits: 300, log: quiet });
    expect(calls).toBe(0); expect(again.skipped).toHaveLength(plan.length); expect(again.creditsUsed).toBe(0);
    const forced = await research(plan.slice(0, 2), { outDir: out, fetcher, mock: true, maxCredits: 300, force: true, log: quiet });
    expect(forced.written).toHaveLength(2);
  });

  it("retries retryable errors with backoff and gives up on 4xx", async () => {
    let n = 0;
    const fake = (async () => { n++; return n < 3 ? new Response("", { status: 429 }) : new Response(JSON.stringify({ answer: "a", results: [{ title: "t", url: "https://u", content: "c" }] }), { status: 200 }); }) as typeof fetch;
    const r = await tavilyFetcher("k", { fetchImpl: fake, baseDelayMs: 1 })(plan[0]!);
    expect(n).toBe(3); expect(r.results[0]!.url).toBe("https://u");
    const bad = (async () => new Response("", { status: 401 })) as typeof fetch;
    await expect(tavilyFetcher("k", { fetchImpl: bad, baseDelayMs: 1 })(plan[0]!)).rejects.toThrow("tavily 401");
  });

  it("uses extract for a known profile URL, and fallback rescues a weak first pass", async () => {
    const j = { ...judges[0]!, knownUrls: ["https://www.linkedin.com/in/example-known"] };
    const p = buildPlan([j], config, "judges");
    const li = p.find((q) => q.id.endsWith("/linkedin"))!;
    expect(li.extractUrls).toEqual(["https://www.linkedin.com/in/example-known"]); expect(li.fallbackQuery).toBeUndefined();
    expect(p.find((q) => q.id.endsWith("/x"))!.extractUrls).toBeUndefined();
    let body: any; const fake = (async (u: string, init: any) => { body = { u, ...JSON.parse(init.body) }; return new Response(JSON.stringify({ results: [{ url: "https://www.linkedin.com/in/example-known", raw_content: "x" }] })); }) as unknown as typeof fetch;
    await tavilyFetcher("k", { fetchImpl: fake })(li);
    expect(body.u).toContain("/extract"); expect(body.urls).toEqual(li.extractUrls);
    const out = tmp(); const queries: string[] = [];
    const fetcher = async (q: Planned) => { queries.push(q.query); return q.query === q.fallbackQuery
      ? { answer: "", results: [{ title: `${j.name} - ${j.company}`, url: "https://e/1", content: "" }] } : { answer: "", results: [{ title: "someone else", url: "https://e/0", content: "" }] }; };
    const bg = p.filter((q) => q.id.endsWith("/background"));
    const st = await research(bg, { outDir: out, fetcher, mock: false, maxCredits: 300, log: quiet });
    expect(queries).toHaveLength(2); expect(st.creditsUsed).toBe(2);
    const f = fm(readFileSync(join(out, bg[0]!.path), "utf8"));
    expect(f).toMatch(/match: confident/); expect(f).toMatch(/creditsUsed: 2/);
    expect(matchOf(j, { answer: "", results: [{ title: j.name, url: "u", content: "unrelated" }] })).toBe("uncertain");
  });
});
