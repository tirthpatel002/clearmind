import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Clearmind } from "../src/store.js";
import { chunkFile, ingestPath, parseFrontmatter, skipReason } from "../src/ingest.js";

let embedded = 0;
const mockEmbedder = async (texts: string[]) => texts.map((t) => {
  embedded++;
  const v = new Float32Array(32);
  for (const w of t.toLowerCase().split(/\W+/).filter(Boolean)) v[[...w].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 32]! += 1;
  return v;
});

const CODE = `import { readFileSync } from "node:fs";

/** Add two numbers. */
export function add(a: number, b: number): number {
  return a + b;
}

export class Counter {
  n = 0;
  /** Step up. */
  inc(): number { return ++this.n; }
  reset() { this.n = 0; }
}
`;
const PY = `import os

def greet(name):
    """Say hello."""
    return "hi " + name

class Box:
    def size(self):
        return 1
`;
const MD = `---
visibleTo: [viewer-a]
source: https://example.com/notes
---
# Notes

Intro line.

## Setup

Run the thing.

\`\`\`
# not a heading
\`\`\`
`;

function fixture(gitInit: boolean): string {
  const d = mkdtempSync(join(tmpdir(), "cm-ing-repo-"));
  mkdirSync(join(d, "src"));
  mkdirSync(join(d, "docs"));
  mkdirSync(join(d, "node_modules", "x"), { recursive: true });
  writeFileSync(join(d, "src", "math.ts"), CODE);
  writeFileSync(join(d, "src", "tool.py"), PY);
  writeFileSync(join(d, "docs", "notes.md"), MD);
  writeFileSync(join(d, "readme.txt"), "First paragraph here.\n\nSecond paragraph here.\n");
  writeFileSync(join(d, ".env"), "TOKEN=abc\n");
  writeFileSync(join(d, "server.pem"), "-----BEGIN-----\n");
  writeFileSync(join(d, "pnpm-lock.yaml"), "lock: 1\n");
  writeFileSync(join(d, "big.txt"), "x".repeat(250_000));
  writeFileSync(join(d, "blob.dat"), Buffer.from([1, 0, 2, 0, 3]));
  writeFileSync(join(d, "node_modules", "x", "i.js"), "export const z = 1;\n");
  if (gitInit) {
    writeFileSync(join(d, ".gitignore"), "ignored.txt\n");
    writeFileSync(join(d, "ignored.txt"), "should not appear\n");
    const g = (...a: string[]) => execFileSync("git", ["-C", d, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { stdio: "ignore" });
    g("init", "-q"); g("add", "-A"); g("commit", "-qm", "init");
  }
  return d;
}
const store = () => new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-ing-")), ownerId: "tirth", embedder: mockEmbedder as any });

describe("ingest: chunking", () => {
  it("splits code into file summary, functions, classes and methods with headers", async () => {
    const r = await chunkFile("src/math.ts", CODE);
    const ids = r.chunks.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["(file)", "add", "Counter", "Counter.inc", "Counter.reset"]));
    const add = r.chunks.find((c) => c.id === "add")!;
    expect(add).toMatchObject({ kind: "function", startLine: 3, endLine: 6 }); // doc comment travels with its function
    expect(add.text).toContain("src/math.ts | function add | lines 3-6 | typescript");
    expect(add.text).toContain("doc: Add two numbers.");
    expect(r.chunks.find((c) => c.id === "Counter.inc")!.kind).toBe("method");
    const file = r.chunks[0]!.text;
    expect(file).toContain("exports: add, Counter");
    expect(file).toContain("- add (function, lines 3-6)");
    expect(file).toContain("imports: node:fs");
  });

  it("splits python by def/class with docstrings", async () => {
    const r = await chunkFile("src/tool.py", PY);
    expect(r.chunks.map((c) => c.id)).toEqual(expect.arrayContaining(["greet", "Box", "Box.size"]));
    expect(r.chunks.find((c) => c.id === "greet")!.text).toContain("doc: Say hello.");
  });

  it("splits markdown by headings with heading path and parses frontmatter", async () => {
    const r = await chunkFile("docs/notes.md", MD);
    expect(r.visibleTo).toEqual(["viewer-a"]);
    expect(r.source).toBe("https://example.com/notes");
    expect(r.chunks.map((c) => c.id)).toEqual(["(file)", "(frontmatter)", "Notes", "Notes > Setup"]);
    expect(r.chunks[3]!.text).toContain("# not a heading");
    expect(parseFrontmatter("---\nvisibleTo:\n  - a\n  - b\n---\nx").data.visibleTo).toEqual(["a", "b"]);
  });

  it("splits plain text into capped paragraph chunks", async () => {
    const r = await chunkFile("a.txt", Array.from({ length: 40 }, (_, i) => `para ${i} `.repeat(10)).join("\n\n"));
    expect(r.chunks.length).toBeGreaterThan(1);
    for (const c of r.chunks) expect(c.text.length).toBeLessThan(1700);
  });

  it("skip rules: secrets, lockfiles, binaries, big files, vendored dirs", () => {
    expect(skipReason(".env.local", 10)).toBe("secret-like");
    expect(skipReason("keys/id_rsa", 10)).toBe("secret-like");
    expect(skipReason("a/server.pem", 10)).toBe("secret-like");
    expect(skipReason("pnpm-lock.yaml", 10)).toBe("lockfile");
    expect(skipReason("x/memory.db", 10)).toBe("binary-or-data");
    expect(skipReason("node_modules/a/b.js", 10)).toBe("ignored-dir");
    expect(skipReason("dist/b.js", 10)).toBe("ignored-dir");
    expect(skipReason("a.txt", 300_000)).toBe("too-large");
    expect(skipReason("a.bin2", 3, Buffer.from([1, 0, 1]))).toBe("binary-or-data");
    expect(skipReason("src/a.ts", 10)).toBeNull();
  });
});

describe("ingest: store", () => {
  it("dry-run counts without writing", async () => {
    const d = fixture(true), cm = store();
    const r = await ingestPath(cm, d, { dryRun: true });
    expect(r.files).toBe(5); // math.ts tool.py notes.md readme.txt .gitignore
    expect(r.written).toBe(0);
    expect(r.chunks).toBeGreaterThan(8);
    expect(r.estTokens).toBeGreaterThan(0);
    expect(r.skipped.map((s) => s.path).sort()).toEqual([".env", "big.txt", "blob.dat", "node_modules/x/i.js", "pnpm-lock.yaml", "server.pem"]);
    expect((await cm.list()).length).toBe(0);
    await cm.close();
  });

  it("ingests a repo with provenance, tags and frontmatter visibility; skips secrets; uses the embedder", async () => {
    const d = fixture(true), cm = store();
    embedded = 0;
    const r = await ingestPath(cm, d);
    expect(r.written).toBe(r.chunks);
    expect(embedded).toBeGreaterThan(0);
    const all = await cm.list();
    expect(all.length).toBe(r.chunks);
    expect(all.some((m) => /TOKEN=abc|BEGIN|should not appear/.test(m.text))).toBe(false);
    const db = (cm as any).sql ?? (await (cm as any).db());
    const rows = db.prepare("SELECT text, extra FROM lessons WHERE status='active'").all() as any[];
    const add = rows.find((x) => x.text.includes("function add |"));
    const ex = JSON.parse(add.extra);
    expect(ex.source).toMatchObject({ path: "src/math.ts", startLine: 3, endLine: 6, kind: "function", symbol: "add" });
    expect(ex.source.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(ex.visibleTo).toEqual(["workspace"]);
    expect(ex.tags).toEqual(expect.arrayContaining(["file-ts", "dir-src", "kind-function"]));
    const md = JSON.parse(rows.find((x) => x.text.includes("section: Notes > Setup")).extra);
    expect(md.visibleTo).toEqual(["viewer-a"]);
    expect(md.source.url).toBe("https://example.com/notes");
    await cm.close();
  });

  it("re-run touches only the changed file, supersedes its changed chunk, retires removed ones", async () => {
    const d = fixture(false), cm = store();
    const first = await ingestPath(cm, d);
    expect(first.written).toBe(first.chunks);
    const again = await ingestPath(cm, d);
    expect(again).toMatchObject({ changedFiles: 0, written: 0, retired: 0 });

    writeFileSync(join(d, "src", "math.ts"), CODE.replace("return a + b;", "return b + a;").replace(/\n {2}reset\(\) \{ this.n = 0; \}/, ""));
    const r = await ingestPath(cm, d);
    expect(r.changedFiles).toBe(1);
    // add changed (+ file summary + Counter header changed because member list changed); inc unchanged
    expect(r.written).toBeGreaterThanOrEqual(2);
    expect(r.unchanged).toBeGreaterThanOrEqual(1);
    expect(r.retired).toBe(1); // Counter.reset
    const all = await cm.list(true);
    const oldAdd = all.find((m) => m.text.includes("return a + b;"))!;
    const newAdd = all.find((m) => m.text.includes("return b + a;"))!;
    expect(oldAdd.status).toBe("replaced");
    expect(oldAdd.replacedBy).toBe(newAdd.id);
    expect((await cm.list()).some((m) => m.text.includes("reset()"))).toBe(false);

    rmSync(join(d, "src", "tool.py"));
    const del = await ingestPath(cm, d);
    expect(del.retired).toBe(5); // (file), (imports), greet, Box, Box.size
    expect((await cm.list()).some((m) => m.text.includes("tool.py"))).toBe(false);
    await cm.close();
  });

  it("--since limits to files changed since a commit", async () => {
    const d = fixture(true), cm = store();
    await ingestPath(cm, d);
    const head = execFileSync("git", ["-C", d, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    writeFileSync(join(d, "readme.txt"), "Changed paragraph.\n");
    const r = await ingestPath(cm, d, { since: head });
    expect(r.changedFiles).toBe(1);
    await cm.close();
  });

  it("ingest core has no domain words", () => {
    const src = readFileSync(join(__dirname, "../src/ingest.ts"), "utf8");
    expect(src.match(/nebius|nvidia|nemotron|tavily|qwen|maya|judge|hackathon|devpost|linkedin|github|twitter/i)?.[0] ?? null).toBeNull();
  });
});
