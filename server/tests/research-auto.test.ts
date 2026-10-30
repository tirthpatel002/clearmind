import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { loadConfig, type SearchFn, type Viewer } from "@clearmind/core";
import { createApp, type AppOptions } from "../src/index.js";

// Offline: fake search + fake chat model. No Tavily or Nebius calls.
const viewers: Record<string, Viewer> = { a: { id: "p-a" }, b: { id: "p-b" }, admin: { id: "admin", admin: true } };
let searches = 0;
const fake: SearchFn = async () => { searches++; return { answer: null, tool: "tavily", credits: 1, results: [
  { title: "Quillmont Observatory", url: "https://example.org/q", content: `Quillmont Observatory sits at 2,400 m altitude.` }] }; };
const chat = async (msgs: { role: string; content: string }[]) => {
  const ctx = msgs.map((m) => m.content).join("\n"), id = /\[([0-9A-Z]{10,})\]/.exec(ctx)?.[1];
  return { content: id ? `It is at 2,400 m [${id}].` : "I don't have that in memory.", model: "fake", promptTokens: 1, completionTokens: 1, usd: 0, ms: 0 };
};
const closers: (() => Promise<void>)[] = [];
afterAll(async () => { for (const c of closers) await c(); });

async function boot(o: Partial<AppOptions> = {}) {
  const app = createApp(loadConfig({ overrides: { dataDir: mkdtempSync(join(tmpdir(), "cm-auto-")) } }), {
    offline: true, appDir: mkdtempSync(join(tmpdir(), "cm-web-")), research: { search: fake, log: () => {} }, ...o,
    resolveViewer: (req) => viewers[/tv=(\w+)/.exec(req.headers.cookie ?? "")?.[1] ?? "a"],
  });
  const srv = createServer((req, res) => void app.handle(req, res));
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  const p0 = (p: string, body: unknown, c = "") => fetch(base + p, { method: "POST", headers: { "Content-Type": "application/json", cookie: c }, body: JSON.stringify(body) });
  const cookie = (await p0("/api/session", { userId: "ws1" })).headers.get("set-cookie")!.split(";")[0]!;
  closers.push(async () => { srv.close(); await app.close(); });
  const get = async (p: string, v: string) => (await fetch(base + p, { headers: { cookie: `${cookie}; tv=${v}` } })).json() as Promise<any>;
  await get("/api/memories", "admin");
  (app.users.get("ws1") as any).opts.chat = chat;
  const post = async (p: string, body: unknown, v: string) => (await p0(p, body, `${cookie}; tv=${v}`)).json() as Promise<any>;
  return { app, get, post, ask: (q: string, v: string) => post("/api/ask", { question: q }, v) };
}

describe("automatic research in chat", () => {
  it("abstain triggers research and the answer uses the new memories; the memories are private to the asker", async () => {
    const s = await boot(); searches = 0;
    const r = await s.ask("How high is Quillmont Observatory?", "a");
    expect(r.lowConfidence).toBe(true);
    expect(r.research).toMatchObject({ ran: true, credits: 1 });
    expect(r.research.memories).toHaveLength(1);
    expect(r.research.sources[0].url).toBe("https://example.org/q");
    expect(r.abstained).toBeFalsy();
    expect(r.cited).toEqual(r.research.memories);
    expect(JSON.stringify(await s.get("/api/memories", "b"))).not.toMatch(/Quillmont/);
    expect(JSON.stringify(await s.get("/api/memories", "a"))).toMatch(/Quillmont/);
    // asked again: now answered from memory, no second search
    const r2 = await s.ask("how high is  Quillmont observatory", "a");
    expect(searches).toBe(1);
    expect(r2.research).toBeNull();
    // the same normalized question within 24h is never searched twice (returns the earlier memories)
    const d1 = await s.post("/api/research", { query: "Zorbax facts" }, "b"), d2 = await s.post("/api/research", { query: "zorbax   FACTS!" }, "b");
    expect(searches).toBe(2);
    expect(d2).toMatchObject({ reused: true, credits: 0 });
    expect(d2.memories.map((m: any) => m.id)).toEqual(d1.memories.map((m: any) => m.id));
  });

  it("the demo chat route researches too and reports it", async () => {
    const s = await boot(); searches = 0;
    const r = await s.post("/api/demo/ask", { q: "How high is Quillmont Observatory?" }, "admin");
    expect(r.research?.ran ?? r.refused).toBeTruthy();
    if (!r.refused) { expect(r.lowConfidence).toBe(true); expect(r.abstained).toBe(false); expect(r.research.items[0].visibleTo).toEqual(["workspace"]); }
  });

  it("a confident answer does not trigger research", async () => {
    const s = await boot(); searches = 0;
    await s.post("/api/memories", { text: "The Quillmont Observatory altitude is 2400 metres" }, "admin");
    const r = await s.ask("Quillmont Observatory altitude", "admin");
    expect(r.lowConfidence).toBe(false);
    expect(r.research).toBeNull();
    expect(searches).toBe(0);
  });

  it("limits: per-user minute and workspace daily cap block research with a clear reason, answer still abstains", async () => {
    const s = await boot({ research: { search: fake, perMin: 1, dailyCredits: 2, log: () => {} } });
    expect((await s.ask("What is alpha thing?", "a")).research.ran).toBe(true);
    const m = await s.ask("What is beta thing?", "a");
    expect(m.research).toMatchObject({ ran: false, reason: "user_minute" });
    expect(m.research.note).toMatch(/limit reached/);
    expect(m.abstained).toBe(true);
    expect((await s.ask("What is gamma thing?", "b")).research.ran).toBe(true);
    const w = await s.ask("What is delta thing?", "admin");
    expect(w.research).toMatchObject({ ran: false, reason: "workspace_day" });
    expect(w.research.note).toMatch(/2\/2/);
    expect(w.abstained).toBe(true);
    const c = await s.get("/api/research/credits", "a");
    expect(c.workspace).toEqual({ used: 2, cap: 2 });
    expect(c.user).toMatchObject({ id: "p-a", used: 1, minuteCap: 1 });
    expect(c.perViewer).toBeUndefined();
    expect((await s.get("/api/research/credits", "admin")).perViewer.length).toBe(2);
  });

  it("not configured or auto off: normal abstain, never an error; user count hook", async () => {
    const s = await boot({ research: { apiKey: () => undefined }, workspaceUserCount: () => 24 });
    const r = await s.ask("What is epsilon thing?", "a");
    expect(r).toMatchObject({ abstained: true, research: { ran: false, reason: "not_configured" } });
    expect((await s.get("/api/research/credits", "a")).users).toBe(24);
    const off = await boot({ research: { search: fake, auto: false, log: () => {} } }); searches = 0;
    expect((await off.ask("What is zeta thing?", "a")).research).toMatchObject({ ran: false, reason: "off" });
    expect(searches).toBe(0);
  });
});
