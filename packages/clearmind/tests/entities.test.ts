import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aliasKey, Clearmind, EntityStore, extractEntities } from "../src/index.js";

const dir = () => mkdtempSync(join(tmpdir(), "cm-ent-"));

describe("entities: store", () => {
  it("resolves aliases and dedupes", () => {
    const s = new EntityStore(join(dir(), "e.db"), "u");
    expect(aliasKey("  Acme   Robotics! ")).toBe("acme robotics");
    const a = s.upsert("Acme Robotics", "company", ["Acme"]), b = s.upsert("acme robotics", null, ["ACME Robotics Ltd"]);
    expect(b.id).toBe(a.id);
    expect(s.list()).toHaveLength(1);
    expect(s.resolve("acme robotics ltd")?.id).toBe(a.id);
    expect(s.get(a.id)!.type).toBe("company");
    s.close();
  });
  it("field changes supersede with provenance instead of overwriting", () => {
    const s = new EntityStore(join(dir(), "e.db"), "u");
    const p = s.upsert("Ada Lovelace");
    s.setField(p.id, "role", "Engineer", { sources: ["https://a.example/1"], memoryIds: ["m1"], fetchedAt: "2026-10-30" });
    s.setField(p.id, "role", "Engineer", { sources: ["https://a.example/2"], memoryIds: ["m2"] });
    s.setField(p.id, "role", "Staff Engineer", { sources: ["https://a.example/3"], memoryIds: ["m3"] });
    const d = s.detail(p.id)!;
    expect(d.fields.role!.value).toBe("Staff Engineer");
    expect(d.history).toHaveLength(1);
    expect(d.history[0]).toMatchObject({ value: "Engineer", status: "replaced", replacedBy: d.fields.role!.id });
    expect(d.history[0]!.sources).toEqual(["https://a.example/1", "https://a.example/2"]);
    s.close();
  });
  it("arbitrary new types, fields and predicates work with zero code change", () => {
    const s = new EntityStore(join(dir(), "e.db"), "u");
    const r = s.upsert("Masala Dosa", "recipe"), c = s.upsert("Udupi", "region");
    s.setField(r.id, "cuisine", "South Indian", { sources: ["https://r.example"] });
    s.setField(r.id, "steps", ["ferment batter", "spread thin", "fill"]);
    s.relate(r.id, "originates in", c.id, { sources: ["https://r.example"] });
    expect(s.counts()).toEqual({ recipe: 1, region: 1 });
    expect(s.list({ type: "recipe" }).map((e) => e.name)).toEqual(["Masala Dosa"]);
    expect(s.searchText("south indian")).toEqual([r.id]);
    expect(s.detail(r.id)!.relations).toEqual([expect.objectContaining({ predicate: "originates in", to: c.id, sources: ["https://r.example"] })]);
    expect(s.profileText(r.id)).toContain("cuisine: South Indian");
    s.close();
  });
  it("users are isolated; list is paginated", () => {
    const p = join(dir(), "e.db");
    const a = new EntityStore(p, "a"), b = new EntityStore(p, "b");
    for (let i = 0; i < 25; i++) a.upsert(`Thing ${String.fromCharCode(65 + i)}`);
    expect(b.list()).toHaveLength(0);
    expect(b.resolve("Thing A")).toBeNull();
    expect(a.list({ limit: 10 })).toHaveLength(10);
    expect(a.list({ limit: 10, offset: 20 })).toHaveLength(5);
    a.close(); b.close();
  });
});

describe("entities: generic extraction", () => {
  it("finds capitalised spans and a free-text relation predicate", () => {
    const x = extractEntities("Yesterday I met Ada Lovelace. Ada Lovelace is the lead engineer at Analytical Engines.");
    expect(x.entities.map((e) => e.name)).toEqual(expect.arrayContaining(["Ada Lovelace", "Analytical Engines"]));
    expect(x.relations).toContainEqual({ from: "Ada Lovelace", predicate: "lead engineer at", to: "Analytical Engines" });
  });
  it("ignores sentence-initial common words", () => {
    expect(extractEntities("Today was fine. Breakfast was poha. Went for a run.").entities).toHaveLength(0);
  });
  it("matches known names in any case via the resolver", () => {
    const known = new Map([["acme robotics", "ent_1"]]);
    const x = extractEntities("met someone from acme robotics today", (n) => known.get(n.toLowerCase()) ?? null);
    expect(x.entities).toContainEqual(expect.objectContaining({ name: "acme robotics", known: true }));
  });
});

describe("entities: Clearmind integration", () => {
  it("remember links; 'who is X' recall; first-word resolution; forgetEntity reports", async () => {
    const cm = new Clearmind({ dir: dir(), ownerId: "u1" });
    const m1 = await cm.remember("Ada Lovelace is the design manager at Analytical Engines.");
    await cm.remember("standup is at 11:15 on weekdays");
    await cm.remember("Lunch with Ada was great.");
    const ada = cm.entities.resolve("Ada Lovelace")!;
    expect(cm.entities.memoriesOf(ada.id)).toHaveLength(2);
    expect(cm.entities.detail(ada.id)!.relations).toContainEqual(expect.objectContaining({ predicate: "design manager at", memoryId: m1.id }));
    expect((await cm.entitySearch("who is ada lovelace"))[0]!.entity.name).toBe("Ada Lovelace");
    expect((await cm.recall("who is Ada Lovelace", 2)).map((m) => m.text)).toEqual(expect.arrayContaining([m1.text]));
    const r = await cm.forgetEntity(ada.id);
    expect(r.memoryIds).toHaveLength(2); expect(r.forgotten).toEqual([]);
    expect(cm.entities.resolve("Ada Lovelace")).toBeNull();
    await cm.close();
  });
  it("forgetting a memory drops its links; cascade forgets linked memories", async () => {
    const cm = new Clearmind({ dir: dir(), ownerId: "u1", config: { ...(await import("../src/config.js")).DEFAULTS, retrieval: { hardForget: true } } as any });
    const m = await cm.remember("Grace Hopper works at Harbor Labs.");
    const k = cm.entities.resolve("Grace Hopper")!;
    await cm.forget(m.id);
    expect(cm.entities.memoriesOf(k.id)).toEqual([]);
    const m2 = await cm.remember("Alan Turing is a researcher at Bletchley Park.");
    const r = await cm.forgetEntity(cm.entities.resolve("Alan Turing")!.id, { cascade: true });
    expect(r.forgotten).toEqual([m2.id]);
    expect((await cm.list()).map((x) => x.id)).not.toContain(m2.id);
    await cm.close();
  });
  it("backfill is idempotent and can be disabled by config", async () => {
    const off = new Clearmind({ dir: dir(), ownerId: "u1", config: { ...(await import("../src/config.js")).DEFAULTS, entities: { enabled: false } } as any });
    await off.remember("Grace Hopper moved to the Compiler team at Harbor Labs.");
    expect(off.entities.list()).toHaveLength(0);
    const { ms: _a, ...a } = await off.backfillEntities(), { ms: _b, ...b } = await off.backfillEntities();
    expect(a.entities).toBeGreaterThan(0);
    expect(b).toEqual(a);
    await off.close();
  });
});

describe("entities: no domain knowledge in core", () => {
  it("entity code names no demo/vendor/person-specific words and no fixed types", () => {
    const src = join(__dirname, "../src");
    const files = ["entities.ts", "extract-entities.ts"].map((f) => join(src, f));
    const store = readFileSync(join(src, "store.ts"), "utf8");
    const ent = store.slice(store.indexOf("// ----- entities"), store.indexOf("get features(): Features"));
    const banned = /nebius|nvidia|nemotron|tavily|jetson|\bnim\b|qwen|maya|kabir|priya|judge|linkedin|github|twitter|\bperson\b|\borg\b|\bproduct\b|\bplace\b|works_at|part_of|\bmakes\b/i;
    for (const [name, text] of [...files.map((f) => [f, readFileSync(f, "utf8")] as const), ["store.ts (entities)", ent] as const]) expect(text.match(banned)?.[0] ?? null, name).toBeNull();
    expect(readdirSync(src)).not.toContain("entity-types.ts");
  });
});
