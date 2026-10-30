import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { distil, loadConfig, tavilySearch, type SearchFn, type Viewer } from "@clearmind/core";
import { createApp, type AppOptions } from "../src/index.js";

// Offline only: the search is a fake; no Tavily or model calls.
const viewers: Record<string, Viewer> = { a: { id: "p-a" }, b: { id: "p-b" }, admin: { id: "admin", admin: true } };
const fake: SearchFn = async (q) => ({ answer: "x", tool: "tavily", credits: 1, results: [
  { title: "Orbweaver Labs about", url: "https://example.org/about", content: `Orbweaver Labs was founded in 2019 (${q}).` },
  { title: "Press", url: "https://example.org/press", content: "Orbweaver Labs opened an office in Lisbon." }] });
const closers: (() => Promise<void>)[] = [];
afterAll(async () => { for (const c of closers) await c(); });

async function boot(research: AppOptions["research"]) {
  const app = createApp(loadConfig({ overrides: { dataDir: mkdtempSync(join(tmpdir(), "cm-res-")) } }), {
    offline: true, appDir: mkdtempSync(join(tmpdir(), "cm-web-")), research,
    resolveViewer: (req) => viewers[/tv=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "a"],
  });
  const srv = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const post0 = (p: string, body: unknown, c = "") => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", cookie: c }, body: JSON.stringify(body) });
  const cookie = (await post0("/api/session", { userId: "ws1" })).headers.get("set-cookie")!.split(";")[0]!;
  closers.push(async () => { srv.close(); await app.close(); });
  return {
    app,
    post: (p: string, body: unknown, v: string) => post0(p, body, `${cookie}; tv=${v}`),
    get: async (p: string, v: string) => (await fetch(base + p, { headers: { cookie: `${cookie}; tv=${v}` } })).json() as Promise<any>,
  };
}

describe("POST /api/research", () => {
  it("503 when no key is configured", async () => {
    const s = await boot({ apiKey: () => undefined });
    const r = await s.post("/api/research", { query: "anything" }, "a");
    expect(r.status).toBe(503);
    expect((await r.json() as any).error).toBe("research not configured");
  });

  it("creates private memories with provenance for a member, workspace ones for admin, and links an entity", async () => {
    const logs: string[] = [];
    const s = await boot({ search: fake, log: (l) => logs.push(l) });
    const r = await (await s.post("/api/research", { query: "Orbweaver Labs history" }, "a")).json() as any;
    expect(r.memories).toHaveLength(2);
    expect(r.credits).toBe(1);
    expect(r.memories[0].visibleTo).toEqual(["p-a"]);
    expect(r.memories[0].sources[0]).toMatchObject({ url: "https://example.org/about", tool: "tavily", query: "Orbweaver Labs history" });
    const cm = s.app.users.get("ws1")!;
    const row = (await (cm as any).db()).prepare("SELECT extra FROM lessons WHERE lesson_id=?").get(r.memories[0].id) as any;
    const extra = JSON.parse(row.extra);
    expect(extra.source).toMatchObject({ url: "https://example.org/about", tool: "tavily" });
    expect(extra.source.fetchedAt).toBeTruthy();
    expect(extra.models.search).toBe("tavily");
    expect(extra.visibleTo).toEqual(["p-a"]);
    expect(JSON.stringify(await s.get("/api/memories", "b"))).not.toMatch(/Lisbon/);
    expect(JSON.stringify(await s.get("/api/memories", "a"))).toMatch(/Lisbon/);
    expect(logs.join("\n")).toMatch(/credits=1 total=1/);
    expect(logs.join("\n")).not.toMatch(/key/i);

    const ents = await s.get("/api/entities?q=Orbweaver", "admin");
    const ent = (ents.items ?? ents.entities ?? ents)[0];
    expect(ent?.id).toBeTruthy();
    const r2 = await (await s.post("/api/research", { query: "Orbweaver Labs offices", entityId: ent.id }, "admin")).json() as any;
    expect(r2.memories[0].visibleTo).toEqual(["workspace"]);
    const d = await s.get(`/api/entities/${ent.id}`, "b");
    expect(d.memoryIds).toEqual(expect.arrayContaining(r2.memories.map((m: any) => m.id)));
    expect((await s.post("/api/research", { query: "x", entityId: "nope" }, "a")).status).toBe(404);
  });

  it("caps query length and rate-limits per viewer", async () => {
    const s = await boot({ search: fake, perMin: 2, log: () => {} });
    expect((await s.post("/api/research", { query: "q".repeat(301) }, "a")).status).toBe(400);
    expect((await s.post("/api/research", { query: "one" }, "a")).status).toBe(200);
    expect((await s.post("/api/research", { query: "two" }, "a")).status).toBe(200);
    expect((await s.post("/api/research", { query: "three" }, "a")).status).toBe(429);
    expect((await s.post("/api/research", { query: "three" }, "b")).status).toBe(200);
  });

  it("hides upstream error details", async () => {
    const s = await boot({ search: async () => { throw new Error("boom secret-ish detail"); }, log: () => {} });
    const r = await s.post("/api/research", { query: "fail" }, "a");
    expect(r.status).toBe(502);
    expect((await r.json() as any).error).toBe("search failed");
  });
});

describe("research core", () => {
  it("tavilySearch calls the API with basic depth via an injected fetch", async () => {
    let sent: any = null;
    const f = (async (url: string, init: any) => { sent = { url, body: JSON.parse(init.body), auth: init.headers.authorization };
      return new Response(JSON.stringify({ answer: "a", results: [{ title: "T", url: "https://e.org", content: "c" }, { title: "bad", url: "javascript:x" }] })); }) as any;
    const r = await tavilySearch("k-test", { fetch: f })("hello", { signal: new AbortController().signal });
    expect(sent.url).toBe("https://api.tavily.com/search");
    expect(sent.body).toMatchObject({ query: "hello", search_depth: "basic", include_answer: true, max_results: 5 });
    expect(r.results).toHaveLength(1);
    const bad = tavilySearch("k-test", { fetch: (async () => new Response("no", { status: 401 })) as any });
    await expect(bad("x", { signal: new AbortController().signal })).rejects.toThrow("search failed (HTTP 401)");
  });

  it("distils with the model when present, falls back to title+snippet otherwise", async () => {
    const s = await fake("q", { signal: new AbortController().signal });
    const chat = async () => ({ content: JSON.stringify({ facts: [{ text: "Founded 2019.", sources: [1] }, { text: "No source", sources: [9] }] }), model: "m-x", promptTokens: 0, completionTokens: 0, usd: 0, ms: 0 });
    const a = await distil("q", s, chat);
    expect(a).toEqual({ facts: [{ text: "Founded 2019.", urls: ["https://example.org/about"] }], model: "m-x" });
    const b = await distil("q", s);
    expect(b.model).toBeNull();
    expect(b.facts).toHaveLength(2);
    const c = await distil("q", s, async () => ({ content: "not json", model: "m", promptTokens: 0, completionTokens: 0, usd: 0, ms: 0 }));
    expect(c.facts).toHaveLength(2);
  });
});
