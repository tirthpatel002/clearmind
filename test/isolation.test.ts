import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind, loadConfig } from "../src/index.js";
import { parseImport } from "../src/clearmind.js";

const dir = () => mkdtempSync(join(tmpdir(), "cm-iso-"));

describe("multi-user isolation", () => {
  it("user A can never read, change or see user B's data", async () => {
    const d = dir();
    const a = new Clearmind({ dir: d, ownerId: "alice" });
    const b = new Clearmind({ dir: d, ownerId: "bob" });
    const ma = await a.remember("Alice is allergic to peanuts", { tags: ["health"] });
    const mb = await b.remember("Bob secret: vault code is 4242", { tags: ["health"] });
    expect((await a.list()).map((m) => m.text).join()).not.toContain("Bob");
    expect((await b.list()).map((m) => m.text).join()).not.toContain("Alice");
    expect((await a.recall("vault code")).map((m) => m.id)).not.toContain(mb.id);
    expect((await a.page({ q: "vault" })).items).toHaveLength(0);
    expect(await a.textsFor([mb.id])).toEqual({});
    await expect(a.update(mb.id, "hacked")).rejects.toThrow();
    await expect(a.confirm(mb.id)).rejects.toThrow();
    const h = await a.history(mb.id).catch(() => []);
    expect(h.map((m) => m.text).join()).not.toContain("Bob");
    const g = b.grant({ agentId: "x-agent", tags: ["health"], purposes: ["p"], consentBy: "bob" });
    expect(() => a.revoke(g.grantId, "alice")).toThrow();
    a.grant({ agentId: "x-agent", tags: ["health"], purposes: ["p"], consentBy: "alice" });
    const r = await a.read({ agentId: "x-agent", purpose: "p", query: "vault code" });
    expect(JSON.stringify(r)).not.toContain("4242");
    expect(b.accessLog().every((e) => e.action !== "read")).toBe(true); expect(a.accessLog().some((e) => e.action === "read")).toBe(true);
    expect((await b.stats()).active).toBe(1);
    expect((await b.list())[0].text).toBe(mb.text);
    expect(ma.id).not.toBe(mb.id);
    await a.close(); await b.close();
  });
});

describe("import", () => {
  it("parses text, json and csv", () => {
    expect(parseImport("one\n\ntwo\n", "text").map((x) => x.text)).toEqual(["one", "two"]);
    expect(parseImport('[{"text":"a","scope":"Work"},"b"]', "json").map((x) => x.text)).toEqual(["a", "b"]);
    const c = parseImport('text,scope\n"hello, world",food\nplain,work\n', "csv");
    expect(c.map((x) => x.text)).toEqual(["hello, world", "plain"]);
  });
  it("imports into the user's workspace only", async () => {
    const d = dir();
    const a = new Clearmind({ dir: d, ownerId: "alice" });
    const r = await a.importMemories("Likes tea\nWorks remotely", "text", { defaultScope: "misc" });
    expect(r.added).toBe(2);
    const b = new Clearmind({ dir: d, ownerId: "bob" });
    expect(await b.list()).toHaveLength(0);
    await a.close(); await b.close();
  });
});

describe("config loading", () => {
  it("defaults < file < env < overrides", () => {
    const d = dir(); const f = join(d, "c.json");
    writeFileSync(f, JSON.stringify({ port: 9001, confidence: { halfLifeDays: 10 } }));
    expect(loadConfig({ env: { CLEARMIND_CONFIG: f } }).port).toBe(9001);
    expect(loadConfig({ env: { CLEARMIND_CONFIG: f } }).confidence.halfLifeDays).toBe(10);
    expect(loadConfig({ env: { CLEARMIND_CONFIG: f, CLEARMIND_PORT: "9002" } }).port).toBe(9002);
    expect(loadConfig({ env: { CLEARMIND_CONFIG: f, CLEARMIND_PORT: "9002" }, overrides: { port: 9003 } }).port).toBe(9003);
    expect(loadConfig({ env: {} }).host).toBe("127.0.0.1");
  });
  it("rejects secrets in config files and public hosts without opt-in", () => {
    const d = dir(); const f = join(d, "c.json");
    writeFileSync(f, JSON.stringify({ nebius: { apiKey: "x" } }));
    expect(() => loadConfig({ env: { CLEARMIND_CONFIG: f } })).toThrow();
    expect(() => loadConfig({ env: {}, overrides: { host: "0.0.0.0" } })).toThrow();
  });
});

describe("abstention", () => {
  it("returns nothing when evidence is weak, and the memory when it is strong", async () => {
    const a = new Clearmind({ dir: dir(), ownerId: "alice" });
    await a.remember("Alice's dentist appointment is on Nov 8 at 17:00", { tags: ["health"] });
    const hit = await a.recallWithEvidence("when is the dentist appointment");
    expect(hit.abstained).toBe(false); expect(hit.memories).toHaveLength(1);
    const miss = await a.recallWithEvidence("what is the name of my cat");
    expect(miss.abstained).toBe(true); expect(miss.memories).toHaveLength(0);
    await a.close();
  });
});
