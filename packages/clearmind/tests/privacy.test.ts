import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind } from "../src/index.js";

const A = { id: "p-a" }, B = { id: "p-b" }, GUEST = { id: "guest" }, ADMIN = { id: "admin", admin: true };
const d = (day: string) => `2026-09-${day}T10:00:00.000Z`;

async function setup() {
  let now = new Date(d("01"));
  const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-priv-")), ownerId: "owner1", now: () => now });
  const shared = await cm.remember("The team offsite is in Lisbon in October", { tags: ["work"] });
  const pa = await cm.remember("Private note for A: the locker code is 1111", { visibleTo: ["p-a"], tags: ["work"] });
  const pb: string[] = [];
  for (const day of ["01", "08", "15"]) {
    now = new Date(d(day));
    pb.push((await cm.remember(`Ordered zorbleberry tart from Quixote Bakery, code word ${day}`, { visibleTo: ["p-b"], tags: ["food"] })).id);
  }
  pb.push((await cm.remember("Zephyrine Quillfeather keeps the vault code 4242", { visibleTo: ["p-b"] })).id);
  now = new Date(d("16"));
  return { cm, shared, pa, pb };
}
const texts = (ms: { text: string }[]) => ms.map((m) => m.text).join("\n");

describe("per-item visibility", () => {
  it("A never sees B's private memories or entities through any read path", async () => {
    const { cm, shared, pa, pb } = await setup();
    expect(texts(await cm.list(true, A))).not.toMatch(/zorbleberry|4242/);
    expect(texts(await cm.list(true, A))).toMatch(/locker code/);
    expect(texts(await cm.recall("zorbleberry tart Quixote Bakery", 10, undefined, A))).not.toMatch(/zorbleberry/);
    expect(texts(await cm.recall("vault code", 10, undefined, A))).not.toMatch(/4242/);
    const ev = await cm.recallWithEvidence("vault code Zephyrine", 6, undefined, A);
    expect(texts(ev.candidates)).not.toMatch(/4242/);
    expect((await cm.page({ q: "zorbleberry", viewer: A })).items).toHaveLength(0);
    expect((await cm.page({ q: "zorbleberry", viewer: B })).items).toHaveLength(3);
    expect(await cm.textsFor(pb, A)).toEqual({});
    await expect(cm.history(pb[0]!, A)).rejects.toThrow();
    await expect(cm.update(pb[0]!, "hacked", { viewer: A })).rejects.toThrow();
    // read by an agent on behalf of A
    cm.grant({ agentId: "agent-x", tags: ["food", "work"], purposes: ["p"], consentBy: "owner1" });
    expect(JSON.stringify(await cm.read({ agentId: "agent-x", purpose: "p", query: "zorbleberry", viewer: A }))).not.toMatch(/zorbleberry/);
    // counts
    expect((await cm.stats(A)).active).toBe(2);
    expect((await cm.stats(B)).active).toBe(5);
    expect((await cm.stats()).active).toBe(6);
    // graph
    const g = await cm.graph({ viewer: A });
    expect(g.mode === "nodes" && g.nodes.map((n) => n.id).sort()).toEqual([shared.id, pa.id].sort());
    // insights: B's recurring pattern exists, but not for A
    expect((await cm.insights({ viewer: B, wait: true })).patterns.length).toBeGreaterThan(0);
    expect((await cm.insights({ viewer: A, wait: true })).patterns).toHaveLength(0);
    // entities
    const ent = cm.entities.resolveId("Zephyrine Quillfeather")!;
    expect(ent).toBeTruthy();
    expect((await cm.entityList({}, A)).entities.map((e) => e.id)).not.toContain(ent);
    expect((await cm.entityList({}, B)).entities.map((e) => e.id)).toContain(ent);
    expect(await cm.entityDetail(ent, A)).toBeNull();
    expect((await cm.entityDetail(ent, B))!.memoryIds).toContain(pb[3]);
    expect((await cm.entitySearch("Zephyrine Quillfeather", 5, A)).map((h) => h.entity.id)).not.toContain(ent);
    expect((await cm.entityLinks(A)).some((l) => l.entityId === ent)).toBe(false);
    expect((await cm.entityRelations(A)).some((r) => r.from === ent || r.to === ent)).toBe(false);
    expect(await cm.canSeeEntity(ent, A)).toBe(false);
    // explicit entity acl overrides
    await cm.setEntityVisibility(ent, ["workspace"]);
    expect(await cm.canSeeEntity(ent, A)).toBe(true);
    expect((await cm.entityDetail(ent, A))!.memoryIds).toEqual([]); // its private memory stays hidden
    await cm.close();
  });

  it("guest sees workspace only; admin and no-viewer see all; workspace items visible to all", async () => {
    const { cm, shared } = await setup();
    expect((await cm.list(false, GUEST)).map((m) => m.id)).toEqual([shared.id]);
    expect((await cm.list(false, ADMIN)).length).toBe(6);
    expect((await cm.list(false)).length).toBe(6);
    for (const v of [A, B, GUEST, ADMIN]) expect((await cm.recall("offsite Lisbon", 5, undefined, v)).map((m) => m.id)).toContain(shared.id);
    expect(await cm.visibleMemoryIds(ADMIN)).toBeNull();
    expect([...(await cm.visibleMemoryIds(GUEST))!]).toEqual([shared.id]);
    await cm.close();
  });

  it("visibility survives correction and is not merged into other principals' duplicates", async () => {
    const { cm, pa } = await setup();
    const nu = await cm.update(pa.id, "Private note for A: the locker code is 2222", { viewer: A });
    expect(nu.visibleTo).toEqual(["p-a"]);
    expect(texts(await cm.list(true, B))).not.toMatch(/locker/);
    const dupe = await cm.remember("Private note for A: the locker code is 2222", { visibleTo: ["p-b"] });
    expect(dupe.confirmed).toBeUndefined();
    expect(dupe.id).not.toBe(nu.id);
    await cm.setVisibility(nu.id, ["workspace"]);
    expect(texts(await cm.list(false, GUEST))).toMatch(/2222/);
    await cm.close();
  });
});
