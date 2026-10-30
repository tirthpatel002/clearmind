// Ingest + privacy: frontmatter visibleTo from the tavily mock fixture lands in cm_acl and filters reads per viewer.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind, ingestPath } from "@clearmind/core";

const FIX = join(import.meta.dirname, "fixtures", "tavily-mock");
const embedder = async (texts: string[]) => texts.map((t) => {
  const v = new Float32Array(16);
  for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) v[[...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 16]! += 1;
  return v;
});
const paths = (ms: any[]) => new Set(ms.map((m) => String(m.path ?? m.extra?.source?.path ?? "")));

describe("ingest honours frontmatter visibleTo", () => {
  it("judge sees workspace + own files, guest workspace only, admin all; INDEX.md skipped", async () => {
    const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-ingvis-")), ownerId: "maya", embedder: embedder as any });
    const r = await ingestPath(cm, FIX);
    expect(r.skipped.some((s) => s.path === "INDEX.md" && s.reason === "index-listing")).toBe(true);
    const db = await (cm as any).db();
    const src = (id: string) => JSON.parse((db.prepare("SELECT extra FROM lessons WHERE lesson_id=?").get(id) as any).extra).source.path as string;
    const seen = async (viewer?: { id: string; admin?: boolean }) => {
      const items = (await cm.list(false, viewer)) as any[];
      return new Set(items.filter((m) => !(m.tags ?? []).includes("kind-dir")).map((m) => src(m.id).split("/").slice(0, 2).join("/")));
    };
    const all = await seen({ id: "admin", admin: true });
    expect(all.has("judges/dhruv-diddi") && all.has("judges/evan-rimer") && [...all].some((p) => p.startsWith("sponsors/"))).toBe(true);
    const x = await seen({ id: "judge-dhruv-diddi" });
    expect(x.has("judges/dhruv-diddi")).toBe(true);
    expect(x.has("judges/evan-rimer")).toBe(false);
    expect([...x].some((p) => p.startsWith("sponsors/"))).toBe(true);
    expect([...x].filter((p) => p.startsWith("judges/"))).toEqual(["judges/dhruv-diddi"]);
    const g = await seen({ id: "guest" });
    expect([...g].every((p) => p.startsWith("sponsors/"))).toBe(true);
    expect(g.size).toBeGreaterThan(0);
    // directory overviews never list another principal's files to guest or to a different judge
    const dirText = async (viewer: { id: string }) => ((await cm.list(false, viewer)) as any[]).filter((m) => (m.tags ?? []).includes("kind-dir")).map((m) => String(m.text)).join("\n");
    expect(await dirText({ id: "guest" })).not.toMatch(/judges\//);
    const dx = await dirText({ id: "judge-dhruv-diddi" });
    expect(dx).toMatch(/dhruv-diddi/);
    expect(dx).not.toMatch(/evan-rimer/);
    const fmx = (db.prepare("SELECT extra FROM lessons").all() as any[]).map((r) => JSON.parse(r.extra)).filter((e) => e.frontmatter);
    expect(fmx.length).toBeGreaterThan(0);
    expect(fmx.every((e) => !("visibleTo" in e.frontmatter))).toBe(true);
    const acl = db.prepare("SELECT count(*) n FROM cm_acl WHERE item_kind='memory' AND principal='judge-dhruv-diddi'").get() as any;
    expect(acl.n).toBeGreaterThan(0);
    await cm.close();
  }, 60_000);
});
