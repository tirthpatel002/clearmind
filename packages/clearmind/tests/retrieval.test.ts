import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EnhancedRetriever, GuardedStore, HybridRetriever, LexicalOverlapReranker, SqliteStore } from "agentmemory";
import { Clearmind } from "../src/store.js";
import { DEFAULTS, loadConfig } from "../src/config.js";
import { RETRIEVAL_DEFAULTS, retrieval, type Retrieval } from "../src/recall/engine.js";

// Deterministic mock embedder: bag of hashed words, no network.
const mockEmbedder = async (texts: string[]) => texts.map((t) => {
  const v = new Float32Array(32);
  for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) v[[...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 32]! += 1;
  return v;
});
const dir = () => mkdtempSync(join(tmpdir(), "cm-r-"));
function make(r?: Partial<Retrieval>, d = dir()) {
  const cm = new Clearmind({ dir: d, ownerId: "tirth", embedder: mockEmbedder as any, config: { ...structuredClone(DEFAULTS), ...(r ? { retrieval: r } : {}) } });
  const eng = (cm as any).engine;
  return { cm, d, eng, opts: eng.enhanced ? (eng.enhanced as any).o : null, guard: eng.store instanceof GuardedStore ? (eng.store as any).o : null };
}

describe("config.retrieval defaults keep the old path", () => {
  it("DEFAULTS has no retrieval section and all defaults are off", () => {
    expect((DEFAULTS as any).retrieval).toBeUndefined();
    expect(loadConfig({ env: {}, file: "/nonexistent.json" }).retrieval).toBeUndefined();
    expect(RETRIEVAL_DEFAULTS).toMatchObject({ fusion: "none", rerank: "off", factKeys: false, newestFirst: false, multiHop: false, principal: null, redaction: "off", audit: false, hardForget: false, types: [], typeBoost: {} });
  });
  for (const [name, r] of [["omitted", undefined], ["empty", {}], ["explicit defaults", RETRIEVAL_DEFAULTS]] as const) {
    it(`${name}: SqliteStore + HybridRetriever`, () => {
      const { eng, cm } = make(r as any);
      expect(eng.store).toBeInstanceOf(SqliteStore);
      expect(eng.retriever).toBeInstanceOf(HybridRetriever);
      expect(eng.enhanced).toBeNull();
      expect(cm.lastRecallConfidence).toBeNull();
    });
  }
  it("forget is disabled by default", async () => {
    const { cm } = make();
    const m = await cm.remember("my dentist is dr shah");
    await expect(cm.forget(m.id)).rejects.toThrow(/hardForget/);
  });
});

describe("each flag reaches agentmemory", () => {
  const cases: [Partial<Retrieval>, (o: any) => void][] = [
    [{ fusion: "weighted", fusionAlpha: 0.3 }, (o) => expect([o.fusion, o.fusionAlpha]).toEqual(["weighted", 0.3])],
    [{ fusion: "rrf", rrfK: 20 }, (o) => expect([o.fusion, o.rrfK]).toEqual(["rrf", 20])],
    [{ rerank: "lexical", rerankPool: 30 }, (o) => { expect(o.reranker).toBeInstanceOf(LexicalOverlapReranker); expect(o.rerankPool).toBe(30); }],
    [{ factKeys: true }, (o) => expect(o.useFactKeys).toBe(true)],
    [{ types: ["preference"] }, (o) => expect(o.types).toEqual(["preference"])],
    [{ typeBoost: { preference: 1.2 } }, (o) => expect(o.typeBoost).toEqual({ preference: 1.2 })],
    [{ newestFirst: true, supersededPenalty: 0.2, includeSuperseded: false }, (o) => expect([o.newestFirst, o.supersededPenalty, o.includeSuperseded]).toEqual([true, 0.2, false])],
    [{ multiHop: true, multiHopTop: 2 }, (o) => { expect([o.multiHop, o.multiHopTop]).toEqual([true, 2]); expect(o.embedder).toBe(mockEmbedder); }],
    [{ principal: { userId: "tirth" } }, (o) => expect(o.principal).toEqual({ userId: "tirth" })],
  ];
  for (const [r, check] of cases) it(`${JSON.stringify(r)} -> EnhancedRetriever`, () => {
    const { eng, opts } = make(r);
    expect(eng.retriever).toBeInstanceOf(EnhancedRetriever);
    check(opts);
  });
  it("only the enabled flag differs from defaults", () => {
    const { opts } = make({ fusion: "rrf" });
    expect([opts.useFactKeys, opts.newestFirst, opts.multiHop, opts.reranker, opts.principal, opts.types]).toEqual([false, false, false, undefined, undefined, undefined]);
  });
  it("lastConfidence surfaces after a recall", async () => {
    const { cm } = make({ fusion: "rrf" });
    await cm.remember("I like green tea"); await cm.remember("my car is a blue honda");
    await cm.recall("what tea do I like", 5);
    expect(cm.lastRecallConfidence).not.toBeNull();
  });
  it("factKeys extracts facts at write time via GuardedStore", async () => {
    const { cm, guard, eng } = make({ factKeys: true });
    expect(guard.factExtractor).toBeTypeOf("function");
    const m = await cm.remember("I moved to Pune in March, and my manager is Asha.");
    const l = await eng.store.getLesson((cm as any).scope, m.id);
    expect(Array.isArray(l.extra.facts) && l.extra.facts.length > 0).toBe(true);
  });
  it("redaction mask is applied by GuardedStore only (retriever unchanged)", async () => {
    const { cm, guard, eng } = make({ redaction: "mask" });
    expect(guard.redaction).toBe("mask");
    expect(eng.retriever).toBeInstanceOf(HybridRetriever);
    const m = await cm.remember("my email is someone@example.com");
    const stored = await eng.store.getLesson((cm as any).scope, m.id);
    expect(stored.text).not.toContain("someone@example.com");
    expect((await cm.list()).map((x) => x.text).join(" ")).not.toContain("someone@example.com");
  });
  it("redaction reject refuses sensitive writes", async () => {
    const { cm } = make({ redaction: "reject" });
    await expect(cm.remember("my email is someone@example.com")).rejects.toThrow();
  });
  it("audit writes a hash-chained log and hardForget deletes + audits", async () => {
    const { cm, d } = make({ audit: true, hardForget: true });
    const m = await cm.remember("my locker code is in the blue notebook");
    await cm.recall("locker", 5);
    expect(await cm.forget(m.id)).toBe(true);
    expect((await cm.list()).map((x) => x.id)).not.toContain(m.id);
    const ops = readFileSync(join(d, "audit.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).op);
    expect(ops).toEqual(expect.arrayContaining(["write", "recall", "forget"]));
  });
  it("no audit file without the flag", async () => {
    const { cm, d } = make({ hardForget: true });
    const m = await cm.remember("temp note");
    expect(await cm.forget(m.id)).toBe(true);
    expect(existsSync(join(d, "audit.jsonl"))).toBe(false);
  });
  it("config file sets retrieval flags", () => {
    expect(retrieval(loadConfig({ env: {}, overrides: { "retrieval.fusion": "rrf" } }).retrieval).fusion).toBe("rrf");
  });
});
