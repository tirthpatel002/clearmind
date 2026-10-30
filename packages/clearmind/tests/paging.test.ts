import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind } from "../src/index.js";

describe("display paging never limits search", () => {
  it("pages by offset with per-viewer totals, and search finds a memory beyond the first page", async () => {
    let t = Date.parse("2026-09-01T10:00:00.000Z");
    const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-page-")), ownerId: "owner1", now: () => new Date(t) });
    await cm.remember("The oldest note mentions quokkaberry jam");
    for (let i = 0; i < 12; i++) { t += 60_000; await cm.remember(`Filler note number ${i} about nothing`); }
    t += 60_000; await cm.remember("Private filler for p-a only", { visibleTo: ["p-a"] });
    const p1 = await cm.page({ limit: 5 });
    expect(p1.items).toHaveLength(5);
    expect(p1.total).toBe(14);
    expect(p1.nextOffset).toBe(5);
    expect(JSON.stringify(p1.items)).not.toMatch(/quokkaberry/);
    const last = await cm.page({ limit: 5, offset: 10 });
    expect(last.items).toHaveLength(4);
    expect(last.nextOffset).toBeNull();
    // search runs over the whole store, not over a loaded page
    const hit = await cm.page({ limit: 5, q: "quokkaberry" });
    expect(hit.items.map((m) => m.text)).toEqual(["The oldest note mentions quokkaberry jam"]);
    expect(hit.total).toBe(1);
    expect((await cm.recall("quokkaberry jam", 3)).map((m) => m.text)).toContain("The oldest note mentions quokkaberry jam");
    // totals are per viewer: visibility applies before paging
    expect((await cm.page({ limit: 5, viewer: { id: "p-b" } })).total).toBe(13);
    expect((await cm.page({ limit: 5, viewer: { id: "p-a" } })).total).toBe(14);
  });
});
