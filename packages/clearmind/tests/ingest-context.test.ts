// Coverage, context and linking guarantees of the ingest (offline: mock embedder, no model calls).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind } from "../src/store.js";
import { chunkFile, ingestPath, treeSitterError } from "../src/ingest.js";

const mockEmbedder = async (texts: string[]) => texts.map((t) => {
  const v = new Float32Array(32);
  for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) v[[...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 32]! += 1;
  return v;
});

const UTIL = `/** Small helpers shared by the app. */
import { join } from "node:path";

// a module-level comment that belongs to no declaration
export const LIMIT = 10;
const hidden = { a: 1 };
export type Pair = [number, number];
interface Shape { w: number; h: number }

export function area(s: Shape): number {
  return s.w * s.h;
}

console.log("module side effect", hidden, join("a", "b"));
export { hidden as visible };
`;
const BIG = `import { area } from "./util.js";

export class Engine {
  speed = 1;
  label: string = "x";

  /** Runs the engine. */
  run(): number {
    return area({ w: this.speed, h: 2 }) + this.stop();
  }

  stop(): number {
${Array.from({ length: 400 }, (_, i) => `    const v${i} = ${i} * this.speed; // line ${i} of a very long method body`).join("\n")}
    return 0;
  }
}

export function huge(): string {
  return "${"y".repeat(9000)}";
}
`;
const DOC = `# Guide

Intro paragraph about the guide.

## Install

Run the installer.

### Linux

Use the package manager.
`;
const PKG = JSON.stringify({ name: "demo", description: "Demo package", scripts: { build: "tsc", test: "vitest" }, dependencies: { zod: "1" } }, null, 2);

function repo(): string {
  const d = mkdtempSync(join(tmpdir(), "cm-ctx-"));
  mkdirSync(join(d, "src", "core"), { recursive: true });
  mkdirSync(join(d, "docs"));
  writeFileSync(join(d, "src", "util.ts"), UTIL);
  writeFileSync(join(d, "src", "core", "engine.ts"), BIG.replace("./util.js", "../util.js"));
  writeFileSync(join(d, "docs", "guide.md"), DOC);
  writeFileSync(join(d, "package.json"), PKG);
  writeFileSync(join(d, "tsconfig.json"), '{ "compilerOptions": { "strict": true } }\n');
  writeFileSync(join(d, "run.sh"), "#!/bin/sh\n# start the app\nnode dist/index.js\n");
  writeFileSync(join(d, "styles.css"), "body { margin: 0; }\n.btn { color: red; }\n");
  writeFileSync(join(d, "fixture.jsonl"), '{"a":1}\n{"a":2}\n');
  return d;
}

/** Every non-blank source line must be in some content chunk's line ranges, and its text must appear in a chunk body. */
function assertCovered(src: string, chunks: { kind: string; text: string; ranges?: [number, number][]; startLine: number; endLine: number }[]) {
  const lines = src.split("\n"), cov = new Set<number>();
  for (const c of chunks) if (c.kind !== "file") for (const [a, b] of c.ranges ?? [[c.startLine, c.endLine]]) for (let i = a; i <= b; i++) cov.add(i);
  const missing = lines.map((l, i) => [i + 1, l] as const).filter(([i, l]) => l.trim() && !cov.has(i));
  expect(missing).toEqual([]);
  const all = chunks.filter((c) => c.kind !== "file").map((c) => c.text).join("\n");
  const joined = all.replace(/\n/g, "");
  for (const l of lines) if (l.trim() && l.length <= 2400) expect(all.includes(l) || joined.includes(l)).toBe(true); // longer lines are sliced; checked by reassembly below
}

describe("ingest: coverage (reconstruction)", () => {
  it("tree-sitter loads (no silent fallback to the heuristic splitter)", async () => {
    const r = await chunkFile("src/util.ts", UTIL);
    expect(treeSitterError).toBeNull();
    expect(r.splitter).toBe("tree-sitter");
  });

  it("keeps imports, consts, types, interfaces, comments, module code and re-exports", async () => {
    const r = await chunkFile("src/util.ts", UTIL);
    assertCovered(UTIL, r.chunks);
    const body = r.chunks.filter((c) => c.kind !== "file").map((c) => c.text).join("\n");
    for (const s of ["a module-level comment", "const hidden", "export type Pair", "interface Shape", "console.log", "export { hidden as visible }"]) expect(body).toContain(s);
    expect(r.info.exports).toEqual(expect.arrayContaining(["LIMIT", "Pair", "area", "visible"]));
  });

  it("splits oversized methods and long lines into marked parts instead of truncating", async () => {
    const src = BIG;
    const r = await chunkFile("src/core/engine.ts", src);
    assertCovered(src, r.chunks);
    for (const c of r.chunks) expect(c.text.length).toBeLessThanOrEqual(4000);
    expect(r.chunks.some((c) => c.text.includes("trimmed"))).toBe(false);
    const stop = r.chunks.filter((c) => c.symbol === "Engine.stop");
    expect(stop.length).toBeGreaterThan(2);
    expect(stop[0]!.text).toMatch(/part 1\/\d+ \(continues\)/);
    expect(stop[1]!.text).toMatch(/part 2\/\d+ \(continued\)/);
    const huge = r.chunks.filter((c) => c.symbol === "huge");
    expect(huge.length).toBeGreaterThan(3);
    expect(huge.map((c) => c.text.split("\n\n").slice(1).join("\n\n")).join("")).toContain("y".repeat(9000));
    // class fields are kept with the class, methods have their own chunks
    const cls = r.chunks.find((c) => c.id === "Engine")!;
    expect(cls.text).toContain("speed = 1;");
    expect(cls.text).toMatch(/run \(lines \d+-\d+\)/);
  });

  it("covers markdown, json, yaml-like, css, shell and jsonl fixtures fully", async () => {
    for (const [p, s] of [["docs/guide.md", DOC], ["package.json", PKG], ["run.sh", "#!/bin/sh\n# start\nnode a.js\n"], ["a.css", "body { margin: 0; }\n"], ["x.jsonl", '{"a":1}\n']] as const) {
      const r = await chunkFile(p, s);
      assertCovered(s, r.chunks);
    }
  });
});

describe("ingest: context per chunk", () => {
  it("text prefix names file, language, symbol path, kind, lines, imports and exports", async () => {
    const r = await chunkFile("src/core/engine.ts", BIG);
    const run = r.chunks.find((c) => c.symbol === "Engine.run")!;
    expect(run.kind).toBe("method");
    expect(run.text).toMatch(/^src\/core\/engine\.ts \| method Engine\.run \| lines \d+-\d+ \| typescript/);
    expect(run.text).toContain("symbol kind: method in Engine");
    expect(run.text).toContain("doc: Runs the engine.");
    expect(run.text).toContain("file imports: ./util.js");
    expect(run.text).toContain("file exports: Engine, huge");
    expect(run.text).toMatch(/calls: .*area/);
    expect(run.text).toContain("this.stop");
  });

  it("markdown chunks carry the heading breadcrumb", async () => {
    const r = await chunkFile("docs/guide.md", DOC);
    const linux = r.chunks.find((c) => c.id === "Guide > Install > Linux")!;
    expect(linux.breadcrumb).toBe("Guide > Install > Linux");
    expect(linux.text).toContain("section: Guide > Install > Linux");
    expect(r.chunks[0]!.text).toContain("headings: Guide, Install, Linux");
  });

  it("small config files are ingested with their keys and purpose", async () => {
    const r = await chunkFile("package.json", PKG);
    expect(r.chunks[0]!.text).toContain("about: demo: Demo package; scripts: build, test");
    expect(r.chunks[0]!.text).toContain("dependencies: zod");
    expect(r.chunks.some((c) => c.kind === "text" && c.text.includes('"vitest"'))).toBe(true);
  });
});

describe("ingest: store with summaries and links", () => {
  it("dry run includes small configs, scripts and fixtures; nothing over the memory cap", async () => {
    const d = repo();
    const r = await ingestPath(null, d, { dryRun: true });
    expect(r.skipped).toEqual([]);
    expect(r.files).toBe(8);
    expect(r.fileSummaries).toBeGreaterThanOrEqual(8);
    expect(r.dirSummaries).toBe(4); // . src src/core docs
    expect(r.importEdges).toBe(1);
    expect(r.callEdges).toBeGreaterThanOrEqual(2); // run -> area (cross-file), run -> this.stop
  });

  it("writes structured context, file + dir summaries, parent/child links and entity relations", async () => {
    const d = repo();
    const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-ctx-st-")), ownerId: "tirth", embedder: mockEmbedder as any });
    const r = await ingestPath(cm, d);
    expect(r.written).toBe(r.chunks);
    const db = await (cm as any).db();
    const rows = (db.prepare("SELECT lesson_id id, text, extra FROM lessons WHERE status='active'").all() as any[]).map((x) => ({ ...x, ex: JSON.parse(x.extra) }));
    const byKey = new Map(rows.map((x) => [x.ex.key, x]));
    const run = rows.find((x) => x.ex.source?.symbol === "Engine.run")!;
    expect(run.ex.context).toMatchObject({ lang: "typescript", kind: "method", symbol: "Engine.run", symbolKind: "method", parentSymbol: "Engine", imports: ["../util.js"], exports: ["Engine", "huge"] });
    expect(run.ex.context.calls).toEqual(expect.arrayContaining([expect.objectContaining({ name: "area", path: "src/util.ts", symbol: "area" }), expect.objectContaining({ name: "this.stop", symbol: "Engine.stop" })]));
    // file -> chunk -> code, dir -> file
    const fileSum = byKey.get(run.ex.links.parent)!;
    expect(fileSum.ex.source.kind).toBe("file");
    expect(fileSum.ex.links.children).toContain(run.ex.key);
    expect(fileSum.text).toContain("depends on (repo files): src/util.ts");
    expect(fileSum.ex.context.dependsOn).toEqual(["src/util.ts"]);
    const utilSum = rows.find((x) => x.ex.source?.kind === "file" && x.ex.source.path === "src/util.ts")!;
    expect(utilSum.text).toContain("used by (repo files): src/core/engine.ts");
    expect(utilSum.text).toContain("about: Small helpers shared by the app.");
    const dir = byKey.get(fileSum.ex.links.parent)!;
    expect(dir.ex.source.kind).toBe("dir");
    expect(dir.text).toContain("src/core/ | directory overview");
    expect(dir.text).toContain("src/core/engine.ts (typescript)");
    expect(dir.text).toContain("depends on directories: src");
    expect(byKey.get(dir.ex.links.parent)!.text).toContain("src/ | directory overview");
    // shared tags tie a file's memories together
    const ftag = run.ex.tags.find((t: string) => t.startsWith("f-"));
    expect(fileSum.ex.tags).toContain(ftag);
    // every link key resolves to a stored memory
    for (const x of rows) for (const k of [x.ex.links?.parent, ...(x.ex.links?.children ?? [])].filter(Boolean)) expect(byKey.has(k)).toBe(true);
    // entities: dir contains file, file imports file, file defines symbol, symbol calls symbol
    const nm = (id: string) => cm.entities.get(id)?.name ?? id;
    const rels = cm.entities.relations().map((e) => `${nm(e.from)} ${e.predicate} ${nm(e.to)}`).join("\n");
    expect(rels).toContain("src/core/engine.ts imports src/util.ts");
    expect(rels).toContain("src/core/engine.ts:Engine.run calls src/util.ts:area");
    expect(rels).toContain("src/core/ contains src/core/engine.ts");
    expect(rels).toContain("src/core/engine.ts defines src/core/engine.ts:Engine.run");
    // re-run is a no-op
    const again = await ingestPath(cm, d);
    expect(again).toMatchObject({ written: 0, retired: 0 });
    // a dependency change updates the dependent's summary ("used by") without touching its code chunks
    writeFileSync(join(d, "src", "extra.ts"), 'import { LIMIT } from "./util.js";\nexport const twice = LIMIT * 2;\n');
    const third = await ingestPath(cm, d);
    expect(third.written).toBeGreaterThan(0);
    const util2 = (await cm.list()).find((m: any) => m.text.startsWith("src/util.ts | file summary"))!;
    expect(util2.text).toContain("src/extra.ts");
    void readFileSync;
    await cm.close();
  });
});
