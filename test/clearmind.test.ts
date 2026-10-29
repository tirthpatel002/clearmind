import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind } from "../src/index.js";

const fresh = (now?: () => Date) => new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-test-")), ownerId: "tirth", now });

describe("block 1: supersession", () => {
  it("update marks the old memory replaced and recall returns the newest only", async () => {
    const cm = fresh();
    const v1 = await cm.remember("standup is at 10:00", { tags: ["work"] });
    const v2 = await cm.update(v1.id, "standup is at 11:30");
    const all = await cm.list(true);
    expect(all.find((m) => m.id === v1.id)).toMatchObject({ status: "replaced", replacedBy: v2.id });
    expect(v2.tags).toEqual(["work"]);
    expect((await cm.recall("when is standup")).map((m) => m.text)).toEqual(["standup is at 11:30"]);
    expect((await cm.history(v1.id)).map((m) => m.text)).toEqual(["standup is at 10:00", "standup is at 11:30"]);
    await cm.close();
  });

  it("remembering with the same key replaces the previous fact automatically", async () => {
    const cm = fresh();
    await cm.remember("office in Pune", { key: "office" });
    await cm.remember("office in Bangalore", { key: "office" });
    await cm.remember("likes tea", { key: "drink" });
    expect((await cm.list()).map((m) => m.text).sort()).toEqual(["likes tea", "office in Bangalore"]);
    await cm.close();
  });

  it("updating an already-replaced id updates the current head", async () => {
    const cm = fresh();
    const a = await cm.remember("v1 fact");
    await cm.update(a.id, "v2 fact");
    const c = await cm.update(a.id, "v3 fact");
    expect((await cm.history(c.id)).length).toBe(3);
    expect((await cm.list()).map((m) => m.text)).toEqual(["v3 fact"]);
    await cm.close();
  });
});

describe("block 2: access policy", () => {
  it("denies reads without purpose and logs them", async () => {
    const cm = fresh();
    await cm.remember("standup is at 10:00", { tags: ["work"] });
    cm.grant({ agentId: "b", tags: ["work"], purposes: ["schedule"], consentBy: "tirth" });
    const r = await cm.read({ agentId: "b", query: "standup" });
    expect(r.decision).toBe("denied");
    expect(r.memories).toEqual([]);
    expect(r.reason).toMatch(/purpose/);
    expect(cm.accessLog("b").at(-1)).toMatchObject({ action: "read", decision: "denied" });
    await cm.close();
  });

  it("allows scoped read with purpose, filters other scopes, logs memory ids", async () => {
    const cm = fresh();
    const w = await cm.remember("standup is at 10:00", { tags: ["work"] });
    await cm.remember("standup of the health club is at 7:00", { tags: ["health"] });
    cm.grant({ agentId: "b", tags: ["work"], purposes: ["schedule"], consentBy: "tirth" });
    const r = await cm.read({ agentId: "b", purpose: "schedule", query: "standup" });
    expect(r.decision).toBe("allowed");
    expect(r.memories.map((m) => m.id)).toEqual([w.id]);
    expect(r.log.memoryIds).toEqual([w.id]);
    expect((await cm.read({ agentId: "b", purpose: "schedule", tags: ["health"], query: "standup" })).decision).toBe("denied");
    expect((await cm.read({ agentId: "b", purpose: "marketing", query: "standup" })).reason).toMatch(/purpose "marketing"/);
    expect((await cm.read({ agentId: "c", purpose: "schedule", query: "standup" })).reason).toMatch(/no grant/);
    await cm.close();
  });

  it("revoke and expiry both deny further reads", async () => {
    let t = new Date("2026-10-29T12:00:00Z");
    const cm = fresh(() => t);
    await cm.remember("standup is at 10:00", { tags: ["work"] });
    const g = cm.grant({ agentId: "b", tags: ["work"], purposes: ["schedule"], consentBy: "tirth" });
    expect((await cm.read({ agentId: "b", purpose: "schedule", query: "standup" })).decision).toBe("allowed");
    cm.revoke(g.grantId, "tirth");
    expect((await cm.read({ agentId: "b", purpose: "schedule", query: "standup" })).reason).toMatch(/revoked/);

    const g2 = cm.grant({ agentId: "b", tags: ["work"], purposes: ["schedule"], consentBy: "tirth", ttlMs: 60_000 });
    expect(g2.expiresAt).toBe("2026-10-29T12:01:00.000Z");
    expect((await cm.read({ agentId: "b", purpose: "schedule", query: "standup" })).decision).toBe("allowed");
    t = new Date(t.getTime() + 61_000);
    expect((await cm.read({ agentId: "b", purpose: "schedule", query: "standup" })).reason).toMatch(/expired/);
    const actions = cm.accessLog().map((e) => `${e.action}:${e.decision}`);
    expect(actions).toEqual(["grant:allowed", "read:allowed", "revoke:allowed", "read:denied", "grant:allowed", "read:allowed", "read:denied"]);
    await cm.close();
  });

  it("grants require consent, scope and purpose", () => {
    const cm = fresh();
    expect(() => cm.grant({ agentId: "b", tags: ["work"], purposes: ["x"], consentBy: "" })).toThrow(/consent/);
    expect(() => cm.grant({ agentId: "b", tags: [], purposes: ["x"], consentBy: "t" })).toThrow(/scope/);
    expect(() => cm.grant({ agentId: "b", tags: ["w"], purposes: [], consentBy: "t" })).toThrow(/purpose/);
  });

  it("policy state persists across process restarts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cm-persist-"));
    const a = new Clearmind({ dir, ownerId: "tirth" });
    await a.remember("standup is at 10:00", { tags: ["work"] });
    const g = a.grant({ agentId: "b", tags: ["work"], purposes: ["schedule"], consentBy: "tirth" });
    a.revoke(g.grantId, "tirth");
    await a.close();
    const b = new Clearmind({ dir, ownerId: "tirth" });
    expect((await b.read({ agentId: "b", purpose: "schedule", query: "standup" })).decision).toBe("denied");
    expect(b.accessLog().length).toBe(3);
    await b.close();
  });
});
