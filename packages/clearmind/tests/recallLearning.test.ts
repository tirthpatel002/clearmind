import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind } from "../src/store.js";
import { DEFAULTS } from "../src/config.js";
import { RETRIEVAL_DEFAULTS, type Retrieval } from "../src/recall/engine.js";

const mockEmbedder = async (texts: string[]) => texts.map((t) => {
  const v = new Float32Array(32);
  for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) v[[...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 32]! += 1;
  return v;
});
function make(r?: Partial<Retrieval>, chat?: any) {
  const d = mkdtempSync(join(tmpdir(), "cm-rl-"));
  const cm = new Clearmind({ dir: d, ownerId: "tirth", embedder: mockEmbedder as any, chat,
    config: { ...structuredClone(DEFAULTS), recall: { ...DEFAULTS.recall, minSimilarity: 0.2 }, ...(r ? { retrieval: r } : {}) } });
  return { cm, d, eng: (cm as any).engine };
}
const facts = ["my passport number is XK4471", "I booked a flight to Lisbon for May", "our travel documents are in the blue folder", "my sister lives in Pune"];

describe("fusion none bug: flags never drop keyword search", () => {
  for (const flags of [{ newestFirst: true }, { mmr: true }, { learning: true }, { types: ["fact"] }] as Partial<Retrieval>[]) {
    it(`${Object.keys(flags)[0]} on: same top hit as the default hybrid path`, async () => {
      const base = make(), on = make(flags);
      for (const f of facts) { await base.cm.remember(f); await on.cm.remember(f); }
      const a = await base.cm.recall("XK4471", 3), b = await on.cm.recall("XK4471", 3);
      expect(on.eng.enhanced).not.toBeNull();
      expect(b[0]?.text).toBe(a[0]?.text);
      expect(b[0]?.text).toContain("XK4471");
    });
  }
  it("engine passes noneSimilarity hybrid", () => expect((make({ newestFirst: true }).eng.enhanced as any).o.noneSimilarity).toBe("hybrid"));
});

describe("MMR and learning flags", () => {
  it("defaults are off and keep the old path", () => {
    expect(RETRIEVAL_DEFAULTS).toMatchObject({ mmr: false, mmrLambda: 0.7, mmrPool: 50, learning: false });
    const { eng, cm } = make();
    expect(eng.enhanced).toBeNull(); expect(cm.recallModel).toBeNull();
  });
  it("mmr options reach EnhancedRetriever", () => {
    const o = (make({ mmr: true, mmrLambda: 0.6, mmrPool: 30 }).eng.enhanced as any).o;
    expect(o).toMatchObject({ mmr: true, mmrLambda: 0.6, mmrPool: 30 });
    expect(o.learning).toBeUndefined();
  });
  it("feedback is a no-op when learning is off", async () => {
    const { cm } = make({ newestFirst: true });
    const m = await cm.remember(facts[0]!);
    await cm.feedback([m.id], [m.id]);
    expect((await (cm as any).mem.current((cm as any).scope, m.id)).extra.learn).toBeUndefined();
  });
});

describe("learning from real use", () => {
  it("ask() citations update Beta counts, accesses, Hebbian links and the score model (persisted)", async () => {
    let ids: string[] = [];
    const chat = async () => ({ content: `Passport XK4471 for the Lisbon trip [${ids[0]}] [${ids[1]}]`, inputTokens: 1, outputTokens: 1 });
    const { cm, d } = make({ learning: true, learningOptions: { minObs: 1 } }, chat);
    const ms = [];
    for (const f of facts) ms.push(await cm.remember(f));
    ids = [ms[0]!.id, ms[1]!.id];
    const before = cm.recallModel!.n;
    const r = await cm.ask("passport XK4471 Lisbon flight", { k: 4 });
    expect(r.cited.sort()).toEqual([...ids].sort());
    const get = (id: string) => (cm as any).mem.current((cm as any).scope, id);
    const a = (await get(ids[0]!)).extra.learn;
    expect(a.s).toBe(1); expect(a.acc).toHaveLength(1); expect(a.links[ids[1]!]).toBeGreaterThan(0);
    const shownNotUsed = r.memories.map((m) => m.id).find((id) => !ids.includes(id));
    if (shownNotUsed) expect((await get(shownNotUsed)).extra.learn.f).toBeGreaterThan(0);
    expect(cm.recallModel!.n).toBeGreaterThan(before);
    expect(existsSync(join(d, "recall-model.json"))).toBe(true);
    const again = new Clearmind({ dir: d, ownerId: "tirth", embedder: mockEmbedder as any, config: { ...structuredClone(DEFAULTS), retrieval: { learning: true } } });
    expect(again.recallModel!.n).toBe(cm.recallModel!.n);
  });
  it("a used memory outranks an equally similar unused one next time", async () => {
    const { cm } = make({ learning: true });
    const x = await cm.remember("favourite tea is green tea from Darjeeling");
    const y = await cm.remember("favourite tea is green tea from Assam");
    await cm.feedback([x.id, y.id], [y.id]);
    await cm.feedback([x.id, y.id], [y.id]);
    const got = await cm.recall("favourite green tea", 2);
    expect(got[0]!.id).toBe(y.id);
  });
  it("corrections count as failures; confirmations count as accesses", async () => {
    const { cm } = make({ learning: true });
    const m = await cm.remember("my dentist is dr shah");
    await cm.confirm(m.id);
    const cur = await (cm as any).mem.current((cm as any).scope, m.id);
    expect(cur.extra.learn.acc).toHaveLength(1);
    await cm.update(m.id, "my dentist is dr mehta");
    const old = await (cm as any).mem.store.getLesson((cm as any).scope, m.id);
    expect(old.extra.learn.f).toBe(1);
  });
});
