// Universal ingest: turn any file or folder (code, markdown, plain text) into memories with provenance.
// Files come from `git ls-files` inside a git work tree (honours .gitignore), else a filesystem walk.
// Re-runs are incremental: a manifest of content hashes means only changed chunks are rewritten
// (same key = supersession) and chunks of removed files are retired.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, extname, join, relative, resolve, sep } from "node:path";
import type { Clearmind } from "./store.js";

export type ChunkKind = "function" | "class" | "method" | "symbol" | "file" | "section" | "text";
export interface Chunk {
  /** Stable id within the file (symbol path, heading path or paragraph index). */
  id: string;
  kind: ChunkKind;
  text: string;
  startLine: number;
  endLine: number;
  symbol?: string;
}
export interface FileChunks { path: string; chunks: Chunk[]; visibleTo?: string[]; source?: string; splitter: string }
export interface IngestOptions {
  dryRun?: boolean;
  /** Only consider files changed since this commit (git work trees). Deleted-file detection still uses the manifest. */
  since?: string;
  visibleTo?: string[];
  /** Extra tags on every memory. */
  tags?: string[];
  maxBytes?: number;
  /** Manifest file (default <dataDir>/ingest-manifest.json). */
  manifest?: string;
  log?: (s: string) => void;
}
export interface IngestResult {
  root: string; commit: string | null; files: number; changedFiles: number; chunks: number; written: number;
  unchanged: number; retired: number; skipped: { path: string; reason: string }[]; estTokens: number; splitters: Record<string, number>;
}

const MAX_BYTES = 200_000;
const CODE_CHARS = 2400;
const TEXT_CHARS = 1500;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".cache", ".worktrees", "__pycache__", ".venv", "venv", ".data"]);
const LOCKFILES = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|[^/]*\.lock)$/;
const SECRETS = /(^|\/)(\.env(\..*)?|.*\.(pem|key|p12|pfx|crt|cer|jks|keystore)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|\.npmrc|\.netrc|\.pgpass|[^/]*credentials[^/]*|[^/]*secrets?\.[a-z]+)$/i;
const DATA_EXT = /\.(db|sqlite3?|db-wal|db-shm|wal|parquet|arrow|bin|pkl|pt|onnx|gguf|safetensors|jsonl|ndjson|map|min\.js|png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|tar|woff2?|ttf|otf|mp[34]|mov|wasm|so|dylib|exe)$/i;
const CODE_EXT: Record<string, string> = { ".ts": "typescript", ".mts": "typescript", ".cts": "typescript", ".tsx": "tsx", ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript", ".jsx": "javascript", ".py": "python" };
const MD_EXT = new Set([".md", ".mdx", ".markdown"]);

const sha = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const estTokens = (s: string) => Math.ceil(s.length / 4);

// ---------- file selection ----------

function git(root: string, args: string[]): string | null {
  try { return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }); } catch { return null; }
}

function walk(dir: string, root: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name), root, out); }
    else if (e.isFile()) out.push(relative(root, join(dir, e.name)).split(sep).join("/"));
  }
}

/** Why a path should not be ingested, or null to ingest it. */
export function skipReason(rel: string, size: number, head?: Buffer, maxBytes = MAX_BYTES): string | null {
  if (rel.split("/").slice(0, -1).some((d) => SKIP_DIRS.has(d))) return "ignored-dir";
  if (SECRETS.test(rel)) return "secret-like";
  if (LOCKFILES.test(rel)) return "lockfile";
  if (DATA_EXT.test(rel)) return "binary-or-data";
  if (size > maxBytes) return "too-large";
  if (size === 0) return "empty";
  if (head && head.subarray(0, 8000).includes(0)) return "binary-or-data";
  return null;
}

function listFiles(root: string, since?: string): { files: string[]; isGit: boolean; commit: string | null; changed: Set<string> | null } {
  const top = git(root, ["rev-parse", "--show-toplevel"])?.trim();
  if (top && resolve(top) === resolve(root)) {
    const files = (git(root, ["ls-files", "-z", "--cached", "--others", "--exclude-standard"]) ?? "").split("\0").filter(Boolean);
    const commit = git(root, ["rev-parse", "HEAD"])?.trim() || null;
    let changed: Set<string> | null = null;
    if (since) {
      const d = git(root, ["diff", "--name-only", "-z", since]) ?? "";
      const u = git(root, ["ls-files", "-z", "--others", "--exclude-standard"]) ?? "";
      changed = new Set([...d.split("\0"), ...u.split("\0")].filter(Boolean));
    }
    return { files: [...new Set(files)].filter((f) => existsSync(join(root, f))).sort(), isGit: true, commit, changed };
  }
  const out: string[] = [];
  walk(root, root, out);
  return { files: out.sort(), isGit: false, commit: null, changed: null };
}

// ---------- frontmatter + markdown ----------

/** Minimal YAML frontmatter: `key: value`, `key: [a, b]` and `- item` lists. */
export function parseFrontmatter(src: string): { data: Record<string, unknown>; body: string; bodyLine: number } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  if (!m) return { data: {}, body: src, bodyLine: 1 };
  const data: Record<string, unknown> = {};
  let last: string | null = null;
  for (const line of m[1]!.split(/\r?\n/)) {
    const item = /^\s*-\s+(.*)$/.exec(line);
    if (item && last) { const v = data[last]; data[last] = [...(Array.isArray(v) ? v : []), unq(item[1]!)]; continue; }
    const kv = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    last = kv[1]!;
    const v = kv[2]!.trim();
    data[last] = v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1).split(",").map(unq).filter(Boolean) : v === "" ? [] : unq(v);
  }
  return { data, body: src.slice(m[0].length), bodyLine: m[0].split("\n").length };
}
const unq = (s: string) => s.trim().replace(/^["']|["']$/g, "");

function splitMarkdown(rel: string, body: string, firstLine: number): Chunk[] {
  const lines = body.split("\n");
  const out: Chunk[] = [];
  const path: string[] = [];
  let start = 0, inFence = false;
  const flush = (end: number) => {
    const text = lines.slice(start, end).join("\n").trim();
    if (!text) return;
    const hp = path.length ? path.join(" > ") : basename(rel);
    for (const [i, part] of capParts(text, TEXT_CHARS).entries())
      out.push({ id: `${hp}${i ? `#${i}` : ""}`, kind: "section", symbol: hp, startLine: firstLine + start, endLine: firstLine + end - 1, text: `${rel} | section: ${hp}\n\n${part}` });
  };
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence;
    const h = !inFence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (!h) return;
    flush(i);
    start = i;
    path.length = Math.min(path.length, h[1]!.length - 1);
    path[h[1]!.length - 1] = h[2]!;
    for (let k = 0; k < path.length; k++) path[k] ??= "";
  });
  flush(lines.length);
  return out;
}

// ---------- plain text ----------

function capParts(text: string, cap: number): string[] {
  if (text.length <= cap) return [text];
  const out: string[] = [];
  let cur = "";
  for (const para of text.split(/\n\s*\n/)) {
    if (cur && cur.length + para.length + 2 > cap) { out.push(cur); cur = ""; }
    if (para.length > cap) { for (let i = 0; i < para.length; i += cap) out.push(para.slice(i, i + cap)); continue; }
    cur = cur ? `${cur}\n\n${para}` : para;
  }
  if (cur) out.push(cur);
  return out;
}

function splitText(rel: string, src: string): Chunk[] {
  const out: Chunk[] = [];
  let line = 1, cur = "", curStart = 1;
  const push = (end: number) => {
    const t = cur.trim();
    if (t) for (const [i, p] of capParts(t, TEXT_CHARS).entries()) out.push({ id: `p${out.length}${i ? `.${i}` : ""}`, kind: "text", startLine: curStart, endLine: end, text: `${rel} | lines ${curStart}-${end}\n\n${p}` });
    cur = "";
  };
  for (const para of src.split(/(\n\s*\n)/)) {
    const n = para.split("\n").length - 1;
    if (/^\n\s*\n$/.test(para)) { line += n; continue; }
    if (cur && cur.length + para.length > TEXT_CHARS) push(line - 1);
    if (!cur) curStart = line;
    cur += (cur ? "\n\n" : "") + para;
    line += n;
  }
  push(line);
  return out;
}

/** Visible text of an HTML page (scripts, styles and tags removed; blocks become paragraphs). Line numbers then refer to the extracted text. */
function htmlText(src: string): string {
  return src.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\/?(p|div|section|article|h[1-6]|li|tr|br|header|footer|main)\b[^>]*>/gi, "\n\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n(\s*\n)+/g, "\n\n").trim();
}

// ---------- code ----------

interface Sym { name: string; kind: ChunkKind; start: number; end: number; signature: string; doc: string; exported: boolean; parent?: string }

const trimCode = (s: string) => (s.length > CODE_CHARS ? `${s.slice(0, CODE_CHARS)}\n… (trimmed)` : s);
const firstLine = (s: string) => s.split("\n")[0]!.replace(/\s*\{\s*$/, "").replace(/:\s*$/, "").trim().slice(0, 200);
const cleanDoc = (s: string) => s.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/+|#)\s?/gm, "").replace(/\*\/\s*$/, "").replace(/^["']{3}|["']{3}$/g, "").trim().slice(0, 400);

let tsInit: Promise<any> | null = null;
const tsLangs = new Map<string, any>();
/** Load web-tree-sitter and a grammar if installed (optional dependency); null when unavailable. */
async function treeSitter(lang: string): Promise<any | null> {
  try {
    const req = createRequire(import.meta.url);
    tsInit ??= (async () => { const P = (await import("web-tree-sitter" as string)).default; await P.init(); return P; })();
    const P = await tsInit;
    if (!tsLangs.has(lang)) {
      const wasm = req.resolve(`tree-sitter-wasms/out/tree-sitter-${lang}.wasm`);
      tsLangs.set(lang, await P.Language.load(wasm));
    }
    const p = new P();
    p.setLanguage(tsLangs.get(lang));
    return p;
  } catch { tsInit = null; return null; }
}

const DECL: Record<string, ChunkKind> = {
  function_declaration: "function", generator_function_declaration: "function", function_definition: "function",
  class_declaration: "class", abstract_class_declaration: "class", class_definition: "class",
  interface_declaration: "symbol", type_alias_declaration: "symbol", enum_declaration: "symbol", lexical_declaration: "symbol", variable_declaration: "symbol",
};

function tsSymbols(root: any, src: string): { syms: Sym[]; imports: string[] } {
  const syms: Sym[] = [], imports: string[] = [];
  const docBefore = (n: any) => { const p = n.previousNamedSibling; return p && p.type === "comment" && n.startPosition.row - p.endPosition.row <= 1 ? cleanDoc(p.text) : ""; };
  const pyDoc = (n: any) => { const b = n.childForFieldName?.("body"); const f = b?.namedChildren?.[0]; return f?.type === "expression_statement" && f.namedChildren[0]?.type === "string" ? cleanDoc(f.namedChildren[0].text) : ""; };
  const nameOf = (n: any): string => n.childForFieldName?.("name")?.text ?? n.namedChildren?.find((c: any) => c.type === "variable_declarator")?.childForFieldName?.("name")?.text ?? "";
  const add = (n: any, outer: any, exported: boolean, parent?: string) => {
    let d = n;
    if (d.type === "decorated_definition") d = d.childForFieldName("definition") ?? d;
    const kind = DECL[d.type];
    if (!kind) return;
    const name = nameOf(d);
    if (!name) return;
    if (kind === "symbol" && (d.type === "lexical_declaration" || d.type === "variable_declaration")) {
      const v = d.namedChildren.find((c: any) => c.type === "variable_declarator")?.childForFieldName("value");
      if (!v || !/function|arrow_function|class/.test(v.type)) { if (exported) syms.push({ name, kind: "symbol", start: outer.startPosition.row, end: outer.endPosition.row, signature: firstLine(outer.text), doc: docBefore(outer), exported, parent }); return; }
    }
    const k: ChunkKind = parent && kind === "function" ? "method" : kind === "symbol" && /function|arrow/.test(d.text.slice(0, 200)) ? "function" : kind;
    syms.push({ name: parent ? `${parent}.${name}` : name, kind: k, start: outer.startPosition.row, end: outer.endPosition.row, signature: firstLine(d.text), doc: docBefore(outer) || pyDoc(d), exported, parent });
    if (kind === "class") {
      const body = d.childForFieldName("body");
      for (const m of body?.namedChildren ?? []) {
        if (m.type === "method_definition" || m.type === "function_definition" || m.type === "decorated_definition") {
          const md = m.type === "decorated_definition" ? m.childForFieldName("definition") : m;
          const mn = md?.childForFieldName("name")?.text;
          if (mn) syms.push({ name: `${name}.${mn}`, kind: "method", start: m.startPosition.row, end: m.endPosition.row, signature: firstLine(md.text), doc: docBefore(m) || pyDoc(md), exported, parent: name });
        }
      }
    }
  };
  for (const n of root.namedChildren) {
    if (/^import/.test(n.type)) { imports.push(n.text.replace(/\s+/g, " ").slice(0, 160)); continue; }
    if (n.type === "export_statement") { const d = n.childForFieldName("declaration") ?? n.namedChildren.find((c: any) => DECL[c.type]); if (d) add(d, n, true); else syms.push(...[]); continue; }
    add(n, n, false);
  }
  void src;
  return { syms, imports };
}

const HEUR = /^(export\s+(default\s+)?)?(async\s+)?(function\*?|class|interface|type|enum|const|let|var|def)\s+([A-Za-z_$][\w$]*)/;
/** Fallback splitter: top-level declarations by line pattern; a declaration runs until the next one. */
function heuristicSymbols(src: string): { syms: Sym[]; imports: string[] } {
  const lines = src.split("\n"), syms: Sym[] = [], imports: string[] = [];
  lines.forEach((l, i) => {
    if (/^(import\s|from\s+\S+\s+import\s)/.test(l)) { imports.push(l.trim().slice(0, 160)); return; }
    const m = HEUR.exec(l);
    if (!m) return;
    const kw = m[4]!, name = m[5]!;
    if ((kw === "const" || kw === "let" || kw === "var") && !/=>|function|class/.test(l) && !m[1]) return;
    let s = i;
    while (s > 0 && /^\s*(\/\/|\/?\*|#|@)/.test(lines[s - 1]!)) s--;
    const kind: ChunkKind = kw === "class" ? "class" : /function|def/.test(kw) || /=>|function/.test(l) ? "function" : "symbol";
    syms.push({ name, kind, start: s, end: i, signature: firstLine(l), doc: cleanDoc(lines.slice(s, i).join("\n")), exported: !!m[1] || kw === "def" || kw === "class" });
  });
  for (let k = 0; k < syms.length; k++) {
    let e = (syms[k + 1]?.start ?? lines.length) - 1;
    while (e > syms[k]!.end && !lines[e]!.trim()) e--;
    syms[k]!.end = e;
  }
  return { syms, imports };
}

async function splitCode(rel: string, src: string, lang: string): Promise<{ chunks: Chunk[]; splitter: string }> {
  const lines = src.split("\n");
  let r: { syms: Sym[]; imports: string[] } | null = null, splitter = "heuristic";
  const p = await treeSitter(lang);
  if (p) { try { const t = p.parse(src); r = tsSymbols(t.rootNode, src); t.delete?.(); splitter = "tree-sitter"; } catch { r = null; } finally { p.delete?.(); } }
  r ??= heuristicSymbols(src);
  const chunks: Chunk[] = [];
  const seen = new Map<string, number>();
  for (const s of r.syms) {
    if (s.kind === "class" && r.syms.some((m) => m.parent === s.name.split(".").pop() && m.kind === "method")) {
      // class chunk = header + member list; methods carry their own code
      const members = r.syms.filter((m) => m.parent === s.name).map((m) => m.name.split(".").pop()).join(", ");
      chunks.push(mk(s, `${lines.slice(s.start, Math.min(s.end, s.start + 3) + 1).join("\n")}\n  … members: ${members}`));
      continue;
    }
    chunks.push(mk(s, lines.slice(s.start, s.end + 1).join("\n")));
  }
  function mk(s: Sym, code: string): Chunk {
    const n = (seen.get(s.name) ?? 0) + 1; seen.set(s.name, n);
    const head = [`${rel} | ${s.kind} ${s.name} | lines ${s.start + 1}-${s.end + 1}`, `signature: ${s.signature}`, s.doc ? `doc: ${s.doc}` : ""].filter(Boolean).join("\n");
    return { id: n > 1 ? `${s.name}~${n}` : s.name, kind: s.kind, symbol: s.name, startLine: s.start + 1, endLine: s.end + 1, text: `${head}\n\n${trimCode(code)}` };
  }
  const exported = r.syms.filter((s) => s.exported && !s.parent).map((s) => `${s.name} (${s.kind})`);
  const top = r.syms.filter((s) => !s.parent).map((s) => s.name);
  const leadLines: string[] = [];
  for (const l of lines) { if (/^\s*(\/\/|\/\*|\*|#(?!!)|"""|''')/.test(l) && !/^\s*#!/.test(l)) leadLines.push(l); else break; }
  const lead = cleanDoc(leadLines.join("\n"));
  const summary = [`${rel} | file summary | ${lines.length} lines`, lead ? `about: ${lead}` : "", exported.length ? `exports: ${exported.join(", ")}` : "", top.length ? `symbols: ${top.join(", ")}` : "", r.imports.length ? `imports:\n${r.imports.join("\n")}` : ""].filter(Boolean).join("\n");
  chunks.unshift({ id: "(file)", kind: "file", startLine: 1, endLine: lines.length, text: summary.slice(0, 3800) });
  if (chunks.length === 1 && src.trim()) chunks.push(...splitText(rel, src));
  return { chunks, splitter };
}

/** Split one file's content into chunks by its type (code by syntax, markdown by headings, else paragraphs). */
export async function chunkFile(rel: string, src: string): Promise<FileChunks> {
  const ext = extname(rel).toLowerCase();
  const lang = CODE_EXT[ext];
  if (lang) { const r = await splitCode(rel, src, lang); return { path: rel, ...r }; }
  if (MD_EXT.has(ext)) {
    const fm = parseFrontmatter(src);
    const vis = fm.data.visibleTo;
    const source = [fm.data.source, fm.data.url].find((x) => typeof x === "string" && x) as string | undefined;
    return { path: rel, chunks: splitMarkdown(rel, fm.body, fm.bodyLine), splitter: "markdown", ...(Array.isArray(vis) && vis.length ? { visibleTo: vis.map(String) } : typeof vis === "string" && vis ? { visibleTo: [vis] } : {}), ...(source ? { source } : {}) };
  }
  if (ext === ".html" || ext === ".htm") return { path: rel, chunks: splitText(rel, htmlText(src)), splitter: "html-text" };
  return { path: rel, chunks: splitText(rel, src), splitter: "text" };
}

// ---------- manifest + run ----------

interface Manifest { roots: Record<string, { commit: string | null; at: string; files: Record<string, { hash: string; chunks: Record<string, { hash: string; id: string }> }> }> }
const readManifest = (p: string): Manifest => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return { roots: {} }; } };

const tagsFor = (rel: string, kind: string) => {
  const ext = extname(rel).slice(1).toLowerCase() || "none";
  const top = rel.includes("/") ? rel.split("/")[0]! : "root";
  return [`file-${ext}`, `dir-${top}`, `kind-${kind}`];
};

/**
 * Ingest a file or folder into `cm` (or only plan it when `cm` is null or dryRun).
 * Memories carry provenance in extra.source: {path, commit, startLine, endLine, kind, symbol, url}.
 */
export async function ingestPath(cm: Clearmind | null, path: string, o: IngestOptions = {}): Promise<IngestResult> {
  const abs = resolve(path);
  const isFile = statSync(abs).isFile();
  const root = isFile ? resolve(abs, "..") : abs;
  const sel = isFile ? { files: [basename(abs)], isGit: false, commit: git(root, ["rev-parse", "HEAD"])?.trim() || null, changed: null } : listFiles(root, o.since);
  const dry = o.dryRun || !cm;
  const mPath = o.manifest ?? (cm ? join(cm.dataDir, "ingest-manifest.json") : "");
  const man = mPath ? readManifest(mPath) : { roots: {} };
  const prev = man.roots[abs]?.files ?? {};
  const next: Manifest["roots"][string]["files"] = {};
  const res: IngestResult = { root: abs, commit: sel.commit, files: 0, changedFiles: 0, chunks: 0, written: 0, unchanged: 0, retired: 0, skipped: [], estTokens: 0, splitters: {} };
  const log = o.log ?? (() => {});
  for (const rel of sel.files) {
    const fp = join(root, rel);
    let st; try { st = statSync(fp); } catch { continue; }
    if (!st.isFile()) continue;
    const why = skipReason(rel, st.size, st.size <= (o.maxBytes ?? MAX_BYTES) ? readFileSync(fp).subarray(0, 8000) : undefined, o.maxBytes ?? MAX_BYTES);
    if (why) { res.skipped.push({ path: rel, reason: why }); continue; }
    const src = readFileSync(fp, "utf8");
    const hash = sha(src);
    res.files++;
    const old = prev[rel];
    if ((old && old.hash === hash) || (sel.changed && old && !sel.changed.has(rel))) { next[rel] = old; continue; }
    res.changedFiles++;
    const fc = await chunkFile(rel, src);
    res.splitters[fc.splitter] = (res.splitters[fc.splitter] ?? 0) + 1;
    const chunks: Record<string, { hash: string; id: string }> = {};
    for (const c of fc.chunks) {
      res.chunks++;
      const ch = sha(c.text);
      const was = old?.chunks[c.id];
      if (was && was.hash === ch) { chunks[c.id] = was; res.unchanged++; continue; }
      res.estTokens += estTokens(c.text);
      if (dry) { chunks[c.id] = { hash: ch, id: "" }; continue; }
      const m = await cm!.remember(c.text.slice(0, 4000), {
        key: `ingest:${sha(abs)}:${rel}#${c.id}`,
        tags: [...tagsFor(rel, c.kind), ...(o.tags ?? [])],
        dedup: false,
        visibleTo: fc.visibleTo ?? o.visibleTo ?? ["workspace"],
        extra: { source: { path: rel, root: abs, commit: sel.commit, startLine: c.startLine, endLine: c.endLine, kind: c.kind, ...(c.symbol ? { symbol: c.symbol } : {}), ...(fc.source ? { url: fc.source } : {}), hash: ch } },
      });
      chunks[c.id] = { hash: ch, id: m.id };
      res.written++;
    }
    // chunks that vanished from a changed file
    for (const [cid, v] of Object.entries(old?.chunks ?? {})) if (!chunks[cid]) { if (!dry && v.id && (await cm!.retire(v.id))) res.retired++; else if (dry) res.retired++; }
    next[rel] = { hash, chunks };
    log(`${rel}: ${fc.chunks.length} chunks (${fc.splitter})`);
  }
  // files that disappeared (only when the whole tree was listed)
  if (!isFile) for (const [rel, f] of Object.entries(prev)) if (!next[rel] && !existsSync(join(root, rel))) for (const v of Object.values(f.chunks)) { if (dry) res.retired++; else if (v.id && (await cm!.retire(v.id))) res.retired++; }
  if (!dry && mPath) {
    // keep previous entries for files that still exist but were skipped this run
    for (const [rel, f] of Object.entries(prev)) if (!next[rel] && existsSync(join(root, rel)) && !res.skipped.some((s) => s.path === rel)) next[rel] = f;
    man.roots[abs] = { commit: sel.commit, at: new Date().toISOString(), files: isFile ? { ...prev, ...next } : next };
    writeFileSync(mPath, JSON.stringify(man));
  }
  return res;
}

/** One-line human summary of an ingest result. */
export function fmtIngest(r: IngestResult, dry: boolean): string {
  const sk: Record<string, number> = {};
  for (const s of r.skipped) sk[s.reason] = (sk[s.reason] ?? 0) + 1;
  return [
    `${dry ? "[dry-run] " : ""}root ${r.root}${r.commit ? ` @ ${r.commit.slice(0, 8)}` : ""}`,
    `files ${r.files} (changed ${r.changedFiles}), chunks ${r.chunks} (new/changed ${r.chunks - r.unchanged}, unchanged ${r.unchanged}), ${dry ? "would write" : "written"} ${dry ? r.chunks - r.unchanged : r.written}, retired ${r.retired}`,
    `skipped ${r.skipped.length}${Object.keys(sk).length ? ` (${Object.entries(sk).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`,
    `est embedding tokens ${r.estTokens}; splitters ${Object.entries(r.splitters).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`,
  ].join("\n");
}
