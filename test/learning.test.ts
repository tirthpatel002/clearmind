import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind, confirmConfidence, detectConflicts, detectPatterns, effectiveConfidence, findDuplicate } from "../src/index.js";

const d = (s: string) => `2026-10-${s}T09:00:00.000Z`;

describe("confidence", () => {
  it("rises with confirmations and decays with time", () => {
    expect(confirmConfidence(0.6)).toBeCloseTo(0.76);
    expect(confirmConfidence(confirmConfidence(0.6))).toBeGreaterThan(0.76);
    expect(confirmConfidence(0.99)).toBeLessThanOrEqual(1);
    const s = { base: 0.8, confirmations: 1, lastConfirmedAt: d("01") };
    expect(effectiveConfidence(s, new Date(d("01")))).toBeCloseTo(0.8);
    expect(effectiveConfidence(s, new Date(d("31")), { halfLifeDays: 30 })).toBeCloseTo(0.4);
    expect(effectiveConfidence(s, new Date("2030-01-01"), { floor: 0.05 })).toBe(0.05);
  });
});

describe("duplicates and conflicts", () => {
  const f = (id: string, text: string, extra: object = {}) => ({ id, text, createdAt: d("01"), status: "active", ...extra });
  it("near-identical text is a duplicate, different numbers or negation are not", () => {
    const facts = [f("a", "Tirth drinks black coffee every morning")];
    expect(findDuplicate("Tirth drinks black coffee every morning.", facts)?.id).toBe("a");
    expect(findDuplicate("Tirth does not drink black coffee every morning", facts)).toBeNull();
    expect(findDuplicate("Gym is at 7", [f("g", "Gym is at 6")])).toBeNull();
  });
  it("flags contradicting numbers and negations, ignores unrelated or replaced facts", () => {
    const c = detectConflicts([
      f("1", "Tirth's flight to Delhi leaves at 18:30"),
      f("2", "Tirth's flight to Delhi leaves at 21:00"),
      f("3", "Tirth likes spicy food"),
      f("4", "Tirth does not like spicy food"),
      f("5", "The office wifi password rotates monthly"),
      f("6", "Tirth's flight to Delhi leaves at 07:00", { status: "replaced" }),
    ]);
    expect(c.map((x) => [x.a, x.b].join("-")).sort()).toEqual(["1-2", "3-4"]);
    expect(c.find((x) => x.a === "1")!.reason).toMatch(/18:30/);
  });
  it("facts with different keys never conflict", () => {
    expect(detectConflicts([f("1", "meeting room A at 10", { key: "k1" }), f("2", "meeting room A at 11", { key: "k2" })])).toEqual([]);
  });
});

describe("patterns", () => {
  it("finds a recurring topic across days with evidence, ignores one-offs", () => {
    const facts = [
      { id: "p1", text: "Ordered paneer tikka from Spice Hub", createdAt: d("01") },
      { id: "p2", text: "Ordered paneer tikka again from Spice Hub", createdAt: d("08") },
      { id: "p3", text: "Paneer tikka order from Spice Hub on Friday", createdAt: d("15") },
      { id: "x1", text: "Renewed passport", createdAt: d("02") },
      { id: "x2", text: "Booked dentist", createdAt: d("03") },
    ];
    const p = detectPatterns(facts);
    expect(p).toHaveLength(1);
    expect(p[0]!.evidence.sort()).toEqual(["p1", "p2", "p3"]);
    expect(p[0]!.terms).toEqual(expect.arrayContaining(["paneer", "tikka"]));
    expect(p[0]!.confidence).toBeGreaterThan(0.5);
    expect(detectPatterns(facts.map((x) => ({ ...x, createdAt: d("01") })))).toEqual([]); // same day only
  });
});

describe("Clearmind learning integration", () => {
  it("remembering the same fact again confirms it; confidence decays then recovers", async () => {
    let now = new Date(d("01"));
    const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-l-")), ownerId: "t", now: () => now, halfLifeDays: 30 });
    const a = await cm.remember("Tirth prefers aisle seats on flights");
    now = new Date(d("31"));
    expect((await cm.list())[0]!.confidence).toBeCloseTo(0.3);
    const b = await cm.remember("Tirth prefers aisle seats on flights.");
    expect(b.confirmed).toBe(true);
    expect(b.id).toBe(a.id);
    expect(b.confirmations).toBe(1);
    expect(b.confidence).toBeCloseTo(0.58);
    expect((await cm.list()).length).toBe(1);
    expect((await cm.conflicts()).length).toBe(0);
    await cm.remember("Tirth does not prefer aisle seats on flights anymore");
    expect((await cm.conflicts()).length).toBe(1);
    await cm.close();
  });

  it("agent lessons come from the agentmemory distiller", async () => {
    let ev = "";
    const llm = async () => {
      return JSON.stringify({ lessons: [{ text: "Ask for the calendar timezone before booking", trigger: "booking a meeting", kind: "prefer", source_event_ids: [ev], confidence: 0.6, updates_lesson_id: null }] });
    };
    const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-les-")), ownerId: "t", llm });
    const run = await cm.startRun("agent-b", "book a meeting");
    ev = await cm.record("agent-b", run, { type: "error", error: "booked in UTC instead of IST" });
    const out = await cm.endRun("agent-b", run, { status: "fail", failureType: "false_done", reason: "wrong timezone" });
    expect(out.length).toBe(1);
    expect((await cm.lessons("agent-b"))[0]!.text).toMatch(/timezone/);
    await cm.close();
  });
});
