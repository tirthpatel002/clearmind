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

export type ChunkKind = "function" | "class" | "method" | "symbol" | "module" | "file" | "dir" | "section" | "text";
export interface Chunk {
  /** Stable id within the file (symbol path, heading path or paragraph index). */
  id: string;
  kind: ChunkKind;
  text: string;
  startLine: number;
  endLine: number;
  symbol?: string;
  /** Exact 1-based line ranges this chunk's body holds (default [[startLine, endLine]]). */
  ranges?: [number, number][];
  /** Part n of total when a unit was split to fit the size cap. */
  part?: { n: number; of: number };
  /** Declaration kind of the enclosing symbol (function, class, interface, type, const, ...). */
  symbolKind?: string;
  signature?: string;
  doc?: string;
  /** Heading breadcrumb (markdown). */
  breadcrumb?: string;
  /** Names this chunk calls (code; resolved against the repo at ingest time). */
  calls?: string[];
}
export interface FileInfo {
  lang: string;
  /** Purpose: leading doc comment, first paragraph, or description field. */
  about: string;
  imports: string[];
  /** Import specifiers (module paths) for dependency edges. */
  importSpecs: string[];
  exports: string[];
  symbols: { name: string; kind: string; startLine: number; endLine: number }[];
  lines: number;
}
export interface FileChunks { path: string; chunks: Chunk[]; visibleTo?: string[]; source?: string; frontmatter?: Record<string, unknown>; splitter: string; info: FileInfo }
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
  /** Skip markdown whose frontmatter says mock: true (test fixtures), so fake data never lands in a real store. */
  skipMock?: boolean;
}
export interface IngestResult {
  root: string; commit: string | null; files: number; changedFiles: number; chunks: number; written: number;
  unchanged: number; retired: number; skipped: { path: string; reason: string }[]; estTokens: number; splitters: Record<string, number>;
  /** Memories planned/written by type, dependency edges and resolved call references. */
  fileSummaries: number; dirSummaries: number; importEdges: number; callEdges: number;
  /** Per written memory: chars sent to the optional entity model pass (entities.llm), for cost estimates. */
  chatInputChars: number[];
}

const MAX_BYTES = 200_000;
const CODE_CHARS = 2400;
const TEXT_CHARS = 1500;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".cache", ".worktrees", "__pycache__", ".venv", "venv", ".data"]);
const LOCKFILES = /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb|Cargo\.lock|poetry\.lock|Gemfile\.lock|composer\.lock|[^/]*\.lock)$/;
const SECRETS = /(^|\/)(\.env(\..*)?|.*\.(pem|key|p12|pfx|crt|cer|jks|keystore)|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|\.npmrc|\.netrc|\.pgpass|[^/]*credentials[^/]*|[^/]*secrets?\.[a-z]+)$/i;
const DATA_EXT = /\.(db|sqlite3?|db-wal|db-shm|wal|parquet|arrow|bin|pkl|pt|onnx|gguf|safetensors|map|min\.js|png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|tar|woff2?|ttf|otf|mp[34]|mov|wasm|so|dylib|exe)$/i;
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
  if (/(^|\/)INDEX\.md$/.test(rel)) return "index-listing";
  if (DATA_EXT.test(rel)) return "binary-or-data";
  // line-delimited data: small files are fixtures/samples worth keeping, big ones are dumps
  if (/\.(jsonl|ndjson)$/i.test(rel) && size > 64_000) return "large-data-dump";
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

// ---------- size-capped line packing (nothing is ever cut off) ----------

/** One piece of a file: 0-based inclusive line range plus its exact text. */
interface Piece { s: number; e: number; text: string; slice?: { n: number; of: number } }

/** Split lines[s..e] into consecutive pieces of at most `cap` chars, preferring breaks at blank lines.
 * A single line longer than `cap` becomes several slices of that line (marked, so they reassemble). */
function pieces(lines: string[], s: number, e: number, cap: number): Piece[] {
  while (s <= e && !lines[s]!.trim()) s++;
  while (e >= s && !lines[e]!.trim()) e--;
  if (s > e) return [];
  const out: Piece[] = [];
  const close = (a: number, b: number) => {
    while (a <= b && !lines[a]!.trim()) a++;
    while (b >= a && !lines[b]!.trim()) b--;
    if (a > b) return;
    const text = lines.slice(a, b + 1).join("\n");
    if (text.length <= cap) { out.push({ s: a, e: b, text }); return; }
    const of = Math.ceil(text.length / cap);
    for (let k = 0; k < of; k++) out.push({ s: a, e: b, text: text.slice(k * cap, (k + 1) * cap), slice: { n: k + 1, of } });
  };
  let a = s, len = 0, lastBlank = -1;
  for (let i = s; i <= e; i++) {
    const L = lines[i]!.length + 1;
    while (len + L > cap && i > a) {
      const cut = lastBlank > a && lastBlank < i ? lastBlank : i - 1;
      close(a, cut);
      a = cut + 1; len = 0; lastBlank = -1;
      for (let k = a; k < i; k++) { len += lines[k]!.length + 1; if (!lines[k]!.trim()) lastBlank = k; }
    }
    len += L;
    if (!lines[i]!.trim()) lastBlank = i;
  }
  close(a, e);
  return out;
}

interface Base { id: string; kind: ChunkKind; symbol?: string; symbolKind?: string; signature?: string; doc?: string; breadcrumb?: string }

/** Turn runs of lines (0-based inclusive) into chunks of at most `cap` body chars; runs inside one chunk are
 * separated by an elision line that names what sits between them (e.g. methods that have their own chunks). */
function emitRuns(lines: string[], base: Base, runs: [number, number][], cap: number, gapLabel?: (afterLine: number) => string): Chunk[] {
  const ps = runs.flatMap(([s, e]) => pieces(lines, s, e, cap));
  const groups: Piece[][] = [];
  let cur: Piece[] = [], len = 0;
  for (const p of ps) {
    const add = p.text.length + 60;
    if (cur.length && (len + add > cap || p.slice || cur[cur.length - 1]!.slice)) { groups.push(cur); cur = []; len = 0; }
    cur.push(p); len += add;
  }
  if (cur.length) groups.push(cur);
  return groups.map((g, i) => {
    const text = g.map((p, k) => (k && g[k - 1]!.e + 1 < p.s ? `${gapLabel ? gapLabel(g[k - 1]!.e) : "  …"}\n${p.text}` : k ? `\n${p.text}` : p.text)).join("\n");
    const ranges = mergeRanges(g.map((p) => [p.s + 1, p.e + 1] as [number, number]));
    return {
      ...base, id: groups.length > 1 ? `${base.id}#${i + 1}` : base.id,
      text,
      startLine: ranges[0]![0], endLine: ranges[ranges.length - 1]![1], ranges,
      ...(groups.length > 1 ? { part: { n: i + 1, of: groups.length } } : {}),
    };
  });
}

function mergeRanges(rs: [number, number][]): [number, number][] {
  const s = [...rs].sort((a, b) => a[0] - b[0]), out: [number, number][] = [];
  for (const r of s) { const l = out[out.length - 1]; if (l && r[0] <= l[1] + 1) l[1] = Math.max(l[1], r[1]); else out.push([...r]); }
  return out;
}

// ---------- markdown ----------

function splitMarkdown(rel: string, src: string): Chunk[] {
  const fm = parseFrontmatter(src);
  const lines = src.split("\n");
  const off = fm.bodyLine - 1; // 0-based index of the first body line
  const out: Chunk[] = [];
  if (off > 0) out.push(...emitRuns(lines, { id: "(frontmatter)", kind: "text", symbol: "frontmatter" }, [[0, off - 1]], TEXT_CHARS));
  const path: string[] = [];
  let start = off, inFence = false;
  const flush = (end: number) => {
    const hp = path.filter(Boolean).length ? path.join(" > ") : basename(rel);
    out.push(...emitRuns(lines, { id: hp, kind: "section", symbol: hp, breadcrumb: hp }, [[start, end - 1]], TEXT_CHARS));
  };
  for (let i = off; i < lines.length; i++) {
    const l = lines[i]!;
    if (/^\s*(```|~~~)/.test(l)) inFence = !inFence;
    const h = !inFence && /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(l);
    if (!h) continue;
    flush(i);
    start = i;
    path.length = Math.min(path.length, h[1]!.length - 1);
    path[h[1]!.length - 1] = clip(h[2]!, 100); // full heading text stays in the body
    for (let k = 0; k < path.length; k++) path[k] ??= "";
  }
  flush(lines.length);
  const seen = new Map<string, number>();
  for (const c of out) { const n = (seen.get(c.id) ?? 0) + 1; seen.set(c.id, n); if (n > 1) c.id = `${c.id}~${n}`; }
  return out;
}

// ---------- code ----------

interface Sym { name: string; kind: ChunkKind; declKind: string; start: number; end: number; signature: string; doc: string; exported: boolean; parent?: string }
interface Syms { syms: Sym[]; imports: string[]; exportNames: string[] }

const firstLine = (s: string) => s.split("\n")[0]!.replace(/\s*\{\s*$/, "").replace(/:\s*$/, "").trim().slice(0, 200);
const cleanDoc = (s: string) => s.replace(/^\s*(\/\*\*?|\*\/|\*|\/\/+|#)\s?/gm, "").replace(/\*\/\s*$/, "").replace(/^["']{3}|["']{3}$/g, "").trim().slice(0, 400);

let tsInit: Promise<any> | null = null;
const tsLangs = new Map<string, any>();
/** Why tree-sitter could not load (null when it loaded or was never tried). */
export let treeSitterError: string | null = null;
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
  } catch (e) { tsInit = null; treeSitterError = String((e as Error)?.message ?? e); return null; }
}

const DECL: Record<string, [ChunkKind, string]> = {
  function_declaration: ["function", "function"], generator_function_declaration: ["function", "function"], function_definition: ["function", "function"],
  function_signature: ["function", "function"],
  class_declaration: ["class", "class"], abstract_class_declaration: ["class", "class"], class_definition: ["class", "class"],
  interface_declaration: ["symbol", "interface"], type_alias_declaration: ["symbol", "type"], enum_declaration: ["symbol", "enum"],
  lexical_declaration: ["symbol", "const"], variable_declaration: ["symbol", "var"], module: ["symbol", "namespace"], internal_module: ["symbol", "namespace"],
};
const MEMBER = new Set(["method_definition", "function_definition", "decorated_definition", "abstract_method_signature", "method_signature"]);

function exportList(text: string): string[] {
  const t = text.replace(/\s+/g, " ");
  if (/^export\s+default\b/.test(t)) return ["default"];
  const star = /^export\s+\*\s*(?:as\s+(\w+)\s*)?from\s*["']([^"']+)/.exec(t);
  if (star) return [star[1] ?? `* from ${star[2]}`];
  const b = /^export\s+(?:type\s+)?\{([^}]*)\}/.exec(t);
  return b ? b[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean) : [];
}

function tsSymbols(root: any): Syms {
  const syms: Sym[] = [], imports: string[] = [], exportNames: string[] = [];
  const docBefore = (n: any) => { const p = n.previousNamedSibling; return p && p.type === "comment" && n.startPosition.row - p.endPosition.row <= 1 ? cleanDoc(p.text) : ""; };
  const pyDoc = (n: any) => { const b = n.childForFieldName?.("body"); const f = b?.namedChildren?.[0]; return f?.type === "expression_statement" && f.namedChildren[0]?.type === "string" ? cleanDoc(f.namedChildren[0].text) : ""; };
  const declarators = (d: any) => (d.namedChildren ?? []).filter((c: any) => c.type === "variable_declarator");
  const add = (n: any, outer: any, exported: boolean) => {
    let d = n;
    if (d.type === "decorated_definition") d = d.childForFieldName("definition") ?? d;
    const k = DECL[d.type];
    if (!k) return false;
    let [kind, declKind] = k;
    let name: string = d.childForFieldName?.("name")?.text ?? "";
    if (d.type === "lexical_declaration" || d.type === "variable_declaration") {
      const ds = declarators(d);
      name = ds.map((x: any) => x.childForFieldName("name")?.text).filter(Boolean).join(", ");
      declKind = /^\s*(export\s+)?(const|let|var)/.exec(outer.text)?.[2] ?? declKind;
      const v = ds[0]?.childForFieldName("value");
      if (ds.length === 1 && v && /function|arrow_function/.test(v.type)) { kind = "function"; declKind = "function"; }
      else if (ds.length === 1 && v && /class/.test(v.type)) { kind = "class"; declKind = "class"; }
    }
    if (!name) return false;
    const doc = docBefore(outer) || pyDoc(d);
    syms.push({ name, kind, declKind, start: outer.startPosition.row, end: outer.endPosition.row, signature: firstLine(d.text), doc, exported });
    if (exported) exportNames.push(...name.split(", "));
    if (kind === "class") {
      const body = d.childForFieldName("body") ?? d.namedChildren.find((c: any) => /class_body|block/.test(c.type));
      for (const m of body?.namedChildren ?? []) {
        if (!MEMBER.has(m.type)) continue;
        const md = m.type === "decorated_definition" ? m.childForFieldName("definition") : m;
        const mn = md?.childForFieldName("name")?.text;
        if (mn) syms.push({ name: `${name}.${mn}`, kind: "method", declKind: "method", start: m.startPosition.row, end: m.endPosition.row, signature: firstLine(md.text), doc: docBefore(m) || pyDoc(md), exported, parent: name });
      }
    }
    return true;
  };
  for (const n of root.namedChildren) {
    if (/^import/.test(n.type) || n.type === "future_import_statement") { imports.push(n.text.replace(/\s+/g, " ").slice(0, 200)); continue; }
    if (n.type === "export_statement") {
      const d = n.childForFieldName("declaration") ?? n.namedChildren.find((c: any) => DECL[c.type]);
      if (!(d && add(d, n, true))) { exportNames.push(...exportList(n.text)); if (/\bfrom\s*["']/.test(n.text)) imports.push(n.text.replace(/\s+/g, " ").slice(0, 200)); }
      continue;
    }
    add(n, n, false);
  }
  return { syms, imports, exportNames: [...new Set(exportNames)] };
}

const HEUR = /^(export\s+(default\s+)?)?(declare\s+)?(abstract\s+)?(async\s+)?(function\*?|class|interface|type|enum|const|let|var|def)\s+([A-Za-z_$][\w$]*)/;
/** Fallback splitter: top-level declarations by line pattern; a declaration runs until the next one. */
function heuristicSymbols(src: string): Syms {
  const lines = src.split("\n"), syms: Sym[] = [], imports: string[] = [], exportNames: string[] = [];
  lines.forEach((l, i) => {
    if (/^(import\s|from\s+\S+\s+import\s)/.test(l)) { imports.push(l.trim().slice(0, 200)); return; }
    if (/^export\s+(\*|\{|default\s+[^fc])/.test(l)) exportNames.push(...exportList(l));
    const m = HEUR.exec(l);
    if (!m) return;
    const kw = m[6]!, name = m[7]!;
    const kind: ChunkKind = kw === "class" ? "class" : /function|def/.test(kw) || /=>|function/.test(l) ? "function" : "symbol";
    syms.push({ name, kind, declKind: kind === "function" ? "function" : kw, start: i, end: i, signature: firstLine(l), doc: "", exported: !!m[1] || kw === "def" || kw === "class" });
    if (m[1]) exportNames.push(name);
  });
  for (let k = 0; k < syms.length; k++) {
    let e = (syms[k + 1]?.start ?? lines.length) - 1;
    while (e > syms[k]!.end && !lines[e]!.trim()) e--;
    syms[k]!.end = e;
  }
  return { syms, imports, exportNames };
}

const NOT_CALLS = new Set("if for while switch catch return typeof function await new super import require yield void delete in of do else case throw async constructor print len str int list dict set tuple isinstance".split(" "));
function callNames(code: string, self: string): string[] {
  const out = new Set<string>();
  for (const m of code.matchAll(/(?:^|[^\w$.])(?:new\s+)?([A-Za-z_$][\w$]*)\s*(?:<[^<>()]*>)?\(/g)) { const n = m[1]!; if (!NOT_CALLS.has(n) && n !== self) out.add(n); }
  for (const m of code.matchAll(/\bthis\.([A-Za-z_$][\w$]*)\s*\(/g)) out.add(`this.${m[1]}`);
  for (const m of code.matchAll(/\bself\.([A-Za-z_]\w*)\s*\(/g)) out.add(`this.${m[1]}`);
  return [...out].slice(0, 60);
}

const importSpecsOf = (imports: string[]) => [...new Set(imports.flatMap((i) => {
  const m = /\bfrom\s*["']([^"']+)["']/.exec(i) ?? /^import\s*["']([^"']+)["']/.exec(i) ?? /require\(\s*["']([^"']+)["']\s*\)/.exec(i);
  if (m) return [m[1]!];
  const py = /^from\s+(\S+)\s+import/.exec(i) ?? /^import\s+([\w.]+)/.exec(i);
  return py ? [py[1]!] : [];
}))];

const leadingDoc = (lines: string[]) => {
  const lead: string[] = [];
  for (const l of lines) { if (/^\s*#!/.test(l) && !lead.length) continue; if (/^\s*(\/\/|\/\*|\*|#|"""|''')/.test(l)) lead.push(l); else if (lead.length || l.trim()) break; }
  return cleanDoc(lead.join("\n"));
};

async function splitCode(rel: string, src: string, lang: string): Promise<{ chunks: Chunk[]; splitter: string; info: FileInfo }> {
  const lines = src.split("\n");
  let r: Syms | null = null, splitter = "heuristic";
  const p = await treeSitter(lang);
  if (p) { try { const t = p.parse(src); r = tsSymbols(t.rootNode); t.delete?.(); splitter = "tree-sitter"; } catch (e) { treeSitterError = String(e); r = null; } finally { p.delete?.(); } }
  r ??= heuristicSymbols(src);
  const isNote = (l: string) => /^\s*(\/\/|\/\*|\*|#(?!!)|@\w)/.test(l);
  // attach the comment / decorator block right above each top-level declaration
  const top = r.syms.filter((s) => !s.parent).sort((a, b) => a.start - b.start);
  top.forEach((s, i) => { const floor = i ? top[i - 1]!.end + 1 : 0; while (s.start - 1 >= floor && isNote(lines[s.start - 1]!)) s.start--; });
  for (const m of r.syms.filter((s) => s.parent)) while (m.start - 1 >= 0 && isNote(lines[m.start - 1]!) && !r.syms.some((o) => o !== m && o.parent === m.parent && o.end === m.start - 1)) m.start--;

  const chunks: Chunk[] = [];
  const seen = new Map<string, number>();
  const uniq = (id: string) => { const n = (seen.get(id) ?? 0) + 1; seen.set(id, n); return n > 1 ? `${id}~${n}` : id; };
  for (const s of r.syms) {
    const base: Base = { id: uniq(s.name), kind: s.kind, symbol: s.name, symbolKind: s.declKind, signature: s.signature, ...(s.doc ? { doc: s.doc } : {}) };
    const members = r.syms.filter((m) => m.parent === s.name).sort((a, b) => a.start - b.start);
    const runs: [number, number][] = [];
    let at = s.start;
    for (const m of members) { if (m.start > at) runs.push([at, m.start - 1]); at = Math.max(at, m.end + 1); }
    if (at <= s.end) runs.push([at, s.end]);
    const label = (after: number) => { const m = members.find((x) => x.start > after); return m ? `  … ${members.filter((x) => x.start > after && x.start < (runs.find((r) => r[0] > after)?.[0] ?? Infinity)).map((x) => `${x.name.split(".").pop()} (lines ${x.start + 1}-${x.end + 1})`).join(", ")} — own chunks` : "  …"; };
    for (const c of emitRuns(lines, base, runs, CODE_CHARS, label)) chunks.push({ ...c, calls: callNames(c.text, s.name.split(".").pop()!) });
  }
  // every line not inside a declaration (imports, statements, fields, comments) goes into module chunks
  const covered = new Uint8Array(lines.length);
  for (const c of chunks) for (const [a, b] of c.ranges!) for (let i = a - 1; i < b; i++) covered[i] = 1;
  const gaps: [number, number][] = [];
  for (let i = 0; i < lines.length; i++) {
    if (covered[i] || !lines[i]!.trim()) continue;
    const last = gaps[gaps.length - 1];
    if (last && lines.slice(last[1] + 1, i).every((l, k) => !l.trim() && !covered[last[1] + 1 + k])) last[1] = i; else gaps.push([i, i]);
  }
  let mi = 0;
  for (const g of gaps) {
    const encl = r.syms.filter((s) => s.kind === "class" && s.start <= g[0] && s.end >= g[1]).sort((a, b) => b.start - a.start)[0];
    const body = lines.slice(g[0], g[1] + 1);
    const allImports = body.every((l) => !l.trim() || /^\s*(import\b|from\s+\S+\s+import\b|export\s+(\*|\{[^}]*\}\s*from)|}\s*from\s|[\w$,{}\s*]+$)/.test(l)) && body.some((l) => /^\s*(import|from)\b/.test(l));
    const id = encl ? `${encl.name}(members)` : allImports ? "(imports)" : `(module)#${++mi}`;
    const base: Base = encl ? { id: uniq(id), kind: "module", symbol: encl.name, symbolKind: "class-members" } : { id: uniq(id), kind: "module", symbol: allImports ? "(imports)" : "(module)", symbolKind: allImports ? "imports" : "module-code" };
    for (const c of emitRuns(lines, base, [g], CODE_CHARS)) chunks.push({ ...c, calls: callNames(c.text, "") });
  }
  chunks.sort((a, b) => a.startLine - b.startLine);
  // keep only call names that point at something this file defines or imports (drops keywords, builtins, prose)
  const importedNames = new Set(r.imports.flatMap((i) => {
    const names: string[] = [];
    const def = /^import\s+(?:type\s+)?([A-Za-z_$][\w$]*)\s*(?:,|from)/.exec(i); if (def) names.push(def[1]!);
    const ns = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(i); if (ns) names.push(ns[1]!);
    const br = /\{([^}]*)\}/.exec(i); if (br) names.push(...br[1]!.split(",").map((x) => x.trim().replace(/^type\s+/, "").split(/\s+as\s+/).pop()!.trim()));
    const py = /^from\s+\S+\s+import\s+\(?([^)]*)\)?/.exec(i); if (py) names.push(...py[1]!.split(",").map((x) => x.trim().split(/\s+as\s+/).pop()!.trim()));
    return names.filter(Boolean);
  }));
  const ownNames = new Set(r.syms.flatMap((s) => s.name.split(", ").map((n) => n.split(".").pop()!)));
  for (const c of chunks) c.calls = (c.calls ?? []).filter((n) => (n.startsWith("this.") ? ownNames.has(n.slice(5)) : ownNames.has(n) || importedNames.has(n)));
  // merge runs of small top-level pieces (one-line consts, tiny helpers, section comments) so each memory has substance
  const merged: Chunk[] = [];
  const small = (c: Chunk) => !c.part && !c.symbol?.includes(".") && c.symbolKind !== "class-members" && (c.kind === "symbol" || c.kind === "module") && c.symbolKind !== "imports" && c.text.length < 500;
  for (const c of chunks) {
    const last = merged[merged.length - 1];
    const group = last && (last as any)._group as Chunk[] | undefined;
    if (last && small(c) && (group ? true : small(last)) && last.text.length + c.text.length + 2 <= CODE_CHARS && !(last.ranges!.some(([a, b]) => c.startLine >= a && c.startLine <= b))) {
      const g = group ?? [last];
      g.push(c);
      const named = g.filter((x) => !x.symbol?.startsWith("("));
      const kinds = [...new Set(g.map((x) => x.kind))];
      const m: Chunk = {
        id: `${g[0]!.id}+${g.length - 1}`, kind: kinds.length === 1 ? kinds[0]! : named.length ? "symbol" : "module",
        symbol: named.length ? named.map((x) => x.symbol).join(", ") : g[0]!.symbol!, symbolKind: [...new Set(g.map((x) => x.symbolKind).filter(Boolean))].join(", "),
        text: g.map((x) => x.text).join("\n\n"), startLine: g[0]!.startLine, endLine: c.endLine, ranges: mergeRanges(g.flatMap((x) => x.ranges!)),
        calls: [...new Set(g.flatMap((x) => x.calls ?? []))],
        ...(named.length ? { signature: named.map((x) => x.signature).filter(Boolean).join(" | ").slice(0, 300) } : {}),
      };
      (m as any)._group = g;
      merged[merged.length - 1] = m;
    } else merged.push(c);
  }
  for (const c of merged) delete (c as any)._group;
  chunks.length = 0; chunks.push(...merged);
  const info: FileInfo = {
    lang, about: leadingDoc(lines), imports: r.imports, importSpecs: importSpecsOf(r.imports), exports: r.exportNames,
    symbols: r.syms.map((s) => ({ name: s.name, kind: s.declKind, startLine: s.start + 1, endLine: s.end + 1 })), lines: lines.length,
  };
  return { chunks, splitter, info };
}

// ---------- other files ----------

const OTHER_LANG: Record<string, string> = { ".json": "json", ".jsonc": "json", ".jsonl": "jsonl", ".ndjson": "jsonl", ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".css": "css", ".scss": "scss", ".html": "html", ".htm": "html", ".sh": "shell", ".bash": "shell", ".zsh": "shell", ".sql": "sql", ".txt": "text", ".svg": "svg", ".xml": "xml", ".go": "go", ".rs": "rust", ".java": "java", ".rb": "ruby", ".c": "c", ".h": "c", ".cpp": "cpp" };
const CODEISH = new Set(["json", "jsonl", "yaml", "toml", "css", "scss", "html", "shell", "sql", "svg", "xml", "go", "rust", "java", "ruby", "c", "cpp"]);
const langOf = (rel: string) => CODE_EXT[extname(rel).toLowerCase()] ?? (MD_EXT.has(extname(rel).toLowerCase()) ? "markdown" : OTHER_LANG[extname(rel).toLowerCase()] ?? (/(^|\/)(Dockerfile|Makefile)$/.test(rel) ? basename(rel).toLowerCase() : "text"));

function otherInfo(rel: string, src: string, lang: string): FileInfo {
  const lines = src.split("\n");
  let about = "", exports: string[] = [], importSpecs: string[] = [];
  if (lang === "json") {
    try {
      const j = JSON.parse(src);
      if (j && typeof j === "object" && !Array.isArray(j)) {
        exports = Object.keys(j).slice(0, 40);
        about = [j.name, j.description].filter((x) => typeof x === "string").join(": ");
        const deps = ["dependencies", "devDependencies", "peerDependencies"].flatMap((k) => Object.keys(j[k] ?? {}));
        importSpecs = deps;
        if (j.scripts && typeof j.scripts === "object") about = `${about}${about ? "; " : ""}scripts: ${Object.keys(j.scripts).join(", ")}`;
      }
    } catch { /* jsonc or broken json: keys from lines */ }
  } else if (lang === "yaml" || lang === "toml") exports = [...src.matchAll(/^\[?([A-Za-z0-9_.-]+)\]?\s*[:=]?/gm)].map((m) => m[1]!).filter((k, i, a) => a.indexOf(k) === i).slice(0, 40);
  else if (lang === "markdown") {
    exports = [...src.matchAll(/^#{1,3}\s+(.+?)\s*#*$/gm)].map((m) => m[1]!).slice(0, 40);
    const body = parseFrontmatter(src).body;
    about = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|```|~~~|<|!\[)/.test(p))?.replace(/\s+/g, " ").slice(0, 400) ?? "";
  } else if (lang === "css" || lang === "scss") exports = [...new Set([...src.matchAll(/^([^{}\n@][^{}\n]*?)\s*\{/gm)].map((m) => m[1]!.trim()))].slice(0, 40);
  else if (lang === "html") about = (/<title>([^<]*)<\/title>/i.exec(src)?.[1] ?? "").trim();
  if (!about) about = leadingDoc(lines);
  if (lang === "html") importSpecs = [...src.matchAll(/(?:src|href)=["']([^"':]+\.(?:js|mjs|ts|css))["']/g)].map((m) => m[1]!);
  if (lang === "shell") importSpecs = [...src.matchAll(/(?:^|\s)(?:\.|source|bash|sh|tsx|node)\s+(\S+\.(?:sh|ts|js|mjs|py))/gm)].map((m) => m[1]!);
  return { lang, about, imports: [], importSpecs: [...new Set(importSpecs)], exports, symbols: [], lines: lines.length };
}

// ---------- rendering: every chunk carries its context as an embeddable text prefix ----------

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const fmtRanges = (rs: [number, number][]) => rs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");

function renderChunk(rel: string, info: FileInfo, c: Chunk): string {
  const head = [
    `${rel} | ${c.kind}${c.symbol ? ` ${c.symbol}` : ""} | lines ${fmtRanges(c.ranges ?? [[c.startLine, c.endLine]])} | ${info.lang}${c.part ? ` | part ${c.part.n}/${c.part.of}${c.part.n > 1 ? " (continued)" : ""}${c.part.n < c.part.of ? " (continues)" : ""}` : ""}`,
    c.breadcrumb ? `section: ${c.breadcrumb}` : "",
    c.symbolKind && c.kind !== "section" ? `symbol kind: ${c.symbolKind}${c.symbol?.includes(".") ? ` in ${c.symbol.split(".").slice(0, -1).join(".")}` : ""}` : "",
    c.signature ? `signature${c.signature.includes(" | ") ? "s" : ""}: ${c.signature}` : "",
    c.doc ? `doc: ${c.doc}` : "",
    info.about && c.kind !== "file" ? `file about: ${clip(info.about, 200)}` : "",
    info.importSpecs.length && info.lang !== "json" ? `file imports: ${clip(info.importSpecs.join(", "), 160)}` : "",
    info.exports.length ? `file ${info.lang === "markdown" ? "headings" : info.symbols.length || CODE_EXT[extname(rel).toLowerCase()] ? "exports" : "keys"}: ${clip(info.exports.join(", "), 160)}` : "",
    c.calls?.length ? `calls: ${clip(c.calls.join(", "), 200)}` : "",
  ].filter(Boolean).map((l) => clip(l, 420)).join("\n");
  // the body is never cut; the context header gives way if a body is unusually close to the memory cap
  return `${head.length + c.text.length + 2 > 4000 ? clip(head, Math.max(200, 3998 - c.text.length - 2)) : head}\n\n${c.text}`;
}

/** File summary text (path, purpose, imports, exports, symbols, dependency edges). Long summaries continue in parts. */
function summaryChunks(rel: string, info: FileInfo, chunks: Chunk[], deps: { dependsOn: string[]; usedBy: string[] } = { dependsOn: [], usedBy: [] }): Chunk[] {
  const lines = [
    `${rel} | file summary | ${info.lang} | ${info.lines} lines | ${chunks.length} chunks`,
    info.about ? `about: ${info.about}` : "",
    info.exports.length ? `${info.lang === "markdown" ? "headings" : info.symbols.length || CODE_EXT[extname(rel).toLowerCase()] ? "exports" : "keys"}: ${info.exports.join(", ")}` : "",
    deps.dependsOn.length ? `depends on (repo files): ${deps.dependsOn.join(", ")}` : "",
    deps.usedBy.length ? `used by (repo files): ${deps.usedBy.join(", ")}` : "",
    info.importSpecs.length ? `${info.lang === "json" ? "dependencies" : "imports"}: ${info.importSpecs.join(", ")}` : "",
    ...(info.symbols.length ? ["symbols:", ...info.symbols.map((s) => `- ${s.name} (${s.kind}, lines ${s.startLine}-${s.endLine})`)] : []),
    ...(!info.symbols.length && chunks.length ? ["chunks:", ...chunks.map((c) => `- ${c.symbol ?? c.id} (lines ${fmtRanges(c.ranges ?? [[c.startLine, c.endLine]])})`)] : []),
  ].filter(Boolean);
  const out = emitRuns(lines, { id: "(file)", kind: "file", symbol: rel }, [[0, lines.length - 1]], 3400);
  return out.map((c) => ({ ...c, startLine: 1, endLine: info.lines, ranges: undefined, text: c.part && c.part.n > 1 ? `${rel} | file summary (part ${c.part.n}/${c.part.of})\n${c.text}` : c.text }));
}

/** Split one file's content into chunks by its type (code by syntax, markdown by headings, else line-packed), each with a context prefix.
 * Chunk 0 is the file summary. Body line ranges of the other chunks cover every non-blank line of the file. */
export async function chunkFile(rel: string, src: string): Promise<FileChunks> {
  const ext = extname(rel).toLowerCase();
  const lang = langOf(rel);
  let body: Chunk[], splitter: string, info: FileInfo, extra: { visibleTo?: string[]; source?: string; frontmatter?: Record<string, unknown> } = {};
  if (CODE_EXT[ext]) ({ chunks: body, splitter, info } = await splitCode(rel, src, lang));
  else {
    info = otherInfo(rel, src, lang);
    if (MD_EXT.has(ext)) {
      const fm = parseFrontmatter(src);
      const vis = fm.data.visibleTo;
      const source = [fm.data.source, fm.data.url].find((x) => typeof x === "string" && x) as string | undefined;
      extra = { ...(Array.isArray(vis) && vis.length ? { visibleTo: vis.map(String) } : typeof vis === "string" && vis ? { visibleTo: [vis] } : {}), ...(source ? { source } : {}),
        // keep the file's frontmatter (minus visibleTo, which lives in the acl) on every chunk, e.g. match: uncertain
        ...(Object.keys(fm.data).some((k) => k !== "visibleTo") ? { frontmatter: Object.fromEntries(Object.entries(fm.data).filter(([k]) => k !== "visibleTo")) } : {}) };
      body = splitMarkdown(rel, src); splitter = "markdown";
    } else {
      const lines = src.split("\n");
      body = emitRuns(lines, { id: "p", kind: "text" }, [[0, lines.length - 1]], CODEISH.has(lang) ? CODE_CHARS : TEXT_CHARS);
      body.forEach((c, i) => { c.id = `p${i}`; });
      splitter = lang === "text" ? "text" : `lines-${lang}`;
    }
  }
  for (const c of body) c.text = renderChunk(rel, info, c);
  return { path: rel, chunks: [...summaryChunks(rel, info, body), ...body], splitter, info, ...extra };
}

// ---------- dependency resolution ----------

const RESOLVE_EXT = ["", ".ts", ".tsx", ".mts", ".cts", ".js", ".mjs", ".cjs", ".jsx", ".py", ".json", "/index.ts", "/index.tsx", "/index.js", "/index.mjs", "/__init__.py"];
function resolveSpec(fromRel: string, spec: string, files: Set<string>, pkgs: Map<string, string>): string | null {
  const norm = (p: string) => { const out: string[] = []; for (const s of p.split("/")) { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); } return out.join("/"); };
  const dir = fromRel.includes("/") ? fromRel.slice(0, fromRel.lastIndexOf("/")) : "";
  const tryBase = (b: string) => { for (const x of [b, b.replace(/\.(m|c)?js$/, ""), b.replace(/\.jsx$/, "")]) for (const e of RESOLVE_EXT) if (files.has(x + e)) return x + e; return null; };
  if (spec.startsWith(".") || spec.startsWith("/")) {
    if (/^\.+[\w]/.test(spec) && extname(fromRel) === ".py") { const dots = /^\.+/.exec(spec)![0].length; let d = dir.split("/"); d = d.slice(0, d.length - (dots - 1)); return tryBase(norm(`${d.join("/")}/${spec.slice(dots).replace(/\./g, "/")}`)); }
    return tryBase(norm(spec.startsWith("/") ? spec.slice(1) : `${dir}/${spec}`));
  }
  for (const [name, entry] of pkgs) if (spec === name || spec.startsWith(`${name}/`)) return spec === name ? entry : tryBase(norm(`${entry.slice(0, entry.indexOf("/src/") >= 0 ? entry.indexOf("/src/") + 4 : entry.lastIndexOf("/"))}/${spec.slice(name.length + 1)}`)) ?? entry;
  if (extname(fromRel) === ".py") return tryBase(spec.replace(/\./g, "/")) ?? tryBase(norm(`${dir}/${spec.replace(/\./g, "/")}`));
  return null;
}

// ---------- manifest + run ----------

interface Manifest { roots: Record<string, { commit: string | null; at: string; files: Record<string, { hash: string; chunks: Record<string, { hash: string; id: string }> }> }> }
const readManifest = (p: string): Manifest => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return { roots: {} }; } };

const tagsFor = (rel: string, kind: string) => {
  const ext = extname(rel).slice(1).toLowerCase() || "none";
  const top = rel.includes("/") ? rel.split("/")[0]! : "root";
  const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ".";
  return [`file-${ext}`, `dir-${top}`, `kind-${kind}`, `f-${sha(rel).slice(0, 10)}`, `d-${sha(dir).slice(0, 10)}`];
};
const dirOf = (rel: string) => (rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : ".");

/**
 * Ingest a file or folder into `cm` (or only plan it when `cm` is null or dryRun).
 * Every memory carries its context twice: as an embeddable text prefix and structured in extra
 * (extra.source: provenance; extra.context: language, symbol path/kind, imports, exports, calls, breadcrumb, part;
 * extra.links: parent/children keys). Per file a summary memory, per directory an overview memory; file -> chunk and
 * dir -> file are linked by keys and shared tags (f-<hash>, d-<hash>), and when entities are on also as entity
 * relations (dir contains file, file defines symbol, file imports file, symbol calls symbol).
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
  const res: IngestResult = { root: abs, commit: sel.commit, files: 0, changedFiles: 0, chunks: 0, written: 0, unchanged: 0, retired: 0, skipped: [], estTokens: 0, splitters: {}, fileSummaries: 0, dirSummaries: 0, importEdges: 0, callEdges: 0, chatInputChars: [] };
  const log = o.log ?? (() => {});
  const rk = sha(abs);
  const keyOf = (rel: string, id: string) => `ingest:${rk}:${rel}#${id}`;

  // pass 1: read and chunk everything (local, cheap) so cross-file context is known before writing
  const got: { rel: string; hash: string; fc: FileChunks; write: boolean }[] = [];
  for (const rel of sel.files) {
    const fp = join(root, rel);
    let st; try { st = statSync(fp); } catch { continue; }
    if (!st.isFile()) continue;
    const why = skipReason(rel, st.size, st.size <= (o.maxBytes ?? MAX_BYTES) ? readFileSync(fp).subarray(0, 8000) : undefined, o.maxBytes ?? MAX_BYTES);
    if (why) { res.skipped.push({ path: rel, reason: why }); continue; }
    const src = readFileSync(fp, "utf8");
    const hash = sha(src);
    const fc = await chunkFile(rel, src);
    if (o.skipMock && String(fc.frontmatter?.mock) === "true") { res.skipped.push({ path: rel, reason: "mock-fixture" }); continue; }
    res.files++;
    const old = prev[rel];
    const write = !(sel.changed && old && !sel.changed.has(rel));
    got.push({ rel, hash, fc, write });
  }
  const files = new Set(got.map((g) => g.rel));
  const pkgs = new Map<string, string>();
  for (const g of got) if (basename(g.rel) === "package.json") {
    try {
      const j = JSON.parse(readFileSync(join(root, g.rel), "utf8"));
      const d = dirOf(g.rel) === "." ? "" : `${dirOf(g.rel)}/`;
      const entry = [j.types, j.main, j.exports?.["."]?.import, j.exports?.["."]?.default, typeof j.exports === "string" ? j.exports : null, "src/index.ts", "index.ts", "index.js"]
        .filter((x) => typeof x === "string").map((x: string) => `${d}${x.replace(/^\.\//, "")}`).map((x) => (files.has(x) ? x : files.has(x.replace(/^(.*\/)?dist\//, "$1src/").replace(/\.(d\.ts|js|mjs)$/, ".ts")) ? x.replace(/^(.*\/)?dist\//, "$1src/").replace(/\.(d\.ts|js|mjs)$/, ".ts") : null)).find(Boolean);
      if (typeof j.name === "string" && entry) pkgs.set(j.name, entry);
    } catch { /* not json */ }
  }
  // dependency edges + symbol tables
  const dependsOn = new Map<string, string[]>(), usedBy = new Map<string, string[]>();
  for (const g of got) {
    const ds = [...new Set(g.fc.info.importSpecs.map((s) => resolveSpec(g.rel, s, files, pkgs)).filter((x): x is string => !!x && x !== g.rel))];
    dependsOn.set(g.rel, ds);
    for (const d of ds) (usedBy.get(d) ?? usedBy.set(d, []).get(d)!).push(g.rel);
    res.importEdges += ds.length;
  }
  const byFile = new Map(got.map((g) => [g.rel, g]));
  const symIn = (rel: string, name: string) => byFile.get(rel)?.fc.info.symbols.find((s) => s.name === name || s.name.split(", ").includes(name));
  const resolveCall = (rel: string, encl: string | undefined, n: string): { path: string; symbol: string } | null => {
    if (n.startsWith("this.")) { const cls = encl?.includes(".") ? encl.split(".")[0] : encl; const s = cls && symIn(rel, `${cls}.${n.slice(5)}`); return s ? { path: rel, symbol: s.name } : null; }
    const own = symIn(rel, n); if (own) return { path: rel, symbol: own.name };
    for (const d of dependsOn.get(rel) ?? []) { const s = symIn(d, n); if (s && byFile.get(d)!.fc.info.exports.includes(n)) return { path: d, symbol: s.name }; }
    for (const d of dependsOn.get(rel) ?? []) for (const dd of dependsOn.get(d) ?? []) { const s = symIn(dd, n); if (s && byFile.get(dd)!.fc.info.exports.includes(n)) return { path: dd, symbol: s.name }; } // re-exports via index files
    return null;
  };

  const es = !dry && cm!.entityCfg.enabled ? cm!.entities : null;
  const ent = (name: string, type: string) => es!.upsert(name, type).id;

  let sinceSave = 0;
  const writeChunks = async (rel: string, fileHash: string, chunks: Chunk[], meta: (c: Chunk) => { tags: string[]; visibleTo: string[]; extra: Record<string, unknown> }, after?: (c: Chunk, memId: string) => void) => {
    const old = prev[rel];
    const out: Record<string, { hash: string; id: string }> = {};
    let changed = false;
    // one batched embedding request set per file instead of one call per memory
    const todo = dry ? [] : chunks.filter((c) => { const w = old?.chunks[c.id]; return !(w && w.hash === sha(c.text)) && c.text.length <= 4000; });
    const vecs = new Map<string, Float32Array>();
    if (todo.length > 1) { const vs = await cm!.embedMany(todo.map((c) => c.text.trim())); vs?.forEach((v, i) => vecs.set(todo[i]!.id, v)); }
    for (const c of chunks) {
      res.chunks++;
      if (c.text.length > 4000) throw new Error(`ingest: chunk ${rel}#${c.id} is ${c.text.length} chars (cap 4000)`);
      const ch = sha(c.text);
      const was = old?.chunks[c.id];
      if (was && was.hash === ch) { out[c.id] = was; res.unchanged++; continue; }
      changed = true;
      res.estTokens += estTokens(c.text);
      res.chatInputChars.push(Math.min(c.text.length, 3000));
      if (dry) { out[c.id] = { hash: ch, id: "" }; continue; }
      const m = meta(c);
      const emb = vecs.get(c.id);
      const mem = await cm!.remember(c.text, { key: keyOf(rel, c.id), dedup: false, ...m, ...(emb ? { embedding: emb } : {}) });
      out[c.id] = { hash: ch, id: mem.id };
      res.written++;
      after?.(c, mem.id);
    }
    for (const [cid, v] of Object.entries(old?.chunks ?? {})) if (!out[cid]) { changed = true; if (!dry && v.id && (await cm!.retire(v.id))) res.retired++; else if (dry) res.retired++; }
    next[rel] = { hash: fileHash, chunks: out };
    // checkpoint so an interrupted run resumes (written chunks are then unchanged; keys supersede on rewrite)
    if (!dry && mPath && ++sinceSave >= 10) { sinceSave = 0; man.roots[abs] = { commit: sel.commit, at: new Date().toISOString(), files: { ...prev, ...next } }; writeFileSync(mPath, JSON.stringify(man)); }
    return changed;
  };

  // pass 2: files
  for (const g of got) {
    const { rel, fc } = g;
    if (!g.write) { next[rel] = prev[rel]!; continue; }
    const body = fc.chunks.filter((c) => c.kind !== "file");
    const deps = { dependsOn: dependsOn.get(rel) ?? [], usedBy: usedBy.get(rel) ?? [] };
    const summary = summaryChunks(rel, fc.info, body, deps);
    const fileKey = keyOf(rel, "(file)");
    const resolved = new Map<string, { name: string; path: string; symbol: string }[]>();
    for (const c of body) {
      const rs = (c.calls ?? []).map((n) => { const r = resolveCall(rel, c.symbol, n); return r ? { name: n, ...r } : null; }).filter((x): x is NonNullable<typeof x> => !!x && !(x.path === rel && x.symbol === c.symbol));
      resolved.set(c.id, rs); res.callEdges += rs.length;
    }
    const fileEnt = es ? ent(rel, "file") : null;
    const changed = await writeChunks(rel, g.hash, [...summary, ...body], (c) => {
      const isSum = c.kind === "file";
      return {
        tags: [...tagsFor(rel, c.kind), ...(o.tags ?? [])],
        visibleTo: fc.visibleTo ?? o.visibleTo ?? ["workspace"],
        extra: {
          source: { path: rel, root: abs, commit: sel.commit, startLine: c.startLine, endLine: c.endLine, kind: c.kind, ...(c.symbol ? { symbol: c.symbol } : {}), ...(fc.source ? { url: fc.source } : {}), hash: sha(c.text) },
          ...(fc.frontmatter ? { frontmatter: fc.frontmatter } : {}),
          context: {
            lang: fc.info.lang, kind: c.kind, ...(c.symbol ? { symbol: c.symbol } : {}), ...(c.symbolKind ? { symbolKind: c.symbolKind } : {}),
            ...(c.symbol?.includes(".") && c.kind !== "section" && !isSum ? { parentSymbol: c.symbol.split(".").slice(0, -1).join(".") } : {}),
            ...(c.signature ? { signature: c.signature } : {}), ...(c.breadcrumb ? { breadcrumb: c.breadcrumb.split(" > ") } : {}),
            ...(c.ranges ? { ranges: c.ranges } : {}), ...(c.part ? { part: c.part } : {}),
            about: fc.info.about, imports: fc.info.importSpecs, exports: fc.info.exports,
            ...(isSum ? { symbols: fc.info.symbols, dependsOn: deps.dependsOn, usedBy: deps.usedBy } : { calls: resolved.get(c.id) ?? [] }),
          },
          links: isSum
            ? { parent: keyOf(`@dir:${dirOf(rel)}`, "(dir)"), children: body.map((b) => keyOf(rel, b.id)), dependsOn: deps.dependsOn.map((d) => keyOf(d, "(file)")), usedBy: deps.usedBy.map((d) => keyOf(d, "(file)")) }
            : { parent: fileKey, calls: [...new Set((resolved.get(c.id) ?? []).map((x) => keyOf(x.path, x.symbol)))] },
        },
      };
    }, (c, memId) => {
      if (!es || !fileEnt) return;
      es.link(memId, fileEnt, c.kind === "file" ? "about" : "part-of", 1);
      if (c.kind !== "file" && c.symbol && c.kind !== "text" && c.kind !== "section" && !c.symbol.startsWith("(")) {
        const sid = ent(`${rel}:${c.symbol}`, c.symbolKind ?? c.kind);
        es.link(memId, sid, "defines", 1);
        es.relate(fileEnt, "defines", sid, { memoryId: memId, sources: [rel], confidence: 1 });
        for (const r of resolved.get(c.id) ?? []) es.relate(sid, "calls", ent(`${r.path}:${r.symbol}`, "symbol"), { memoryId: memId, sources: [rel], confidence: 0.8 });
      }
      if (c.kind === "file") for (const d of deps.dependsOn) es.relate(fileEnt, "imports", ent(d, "file"), { memoryId: memId, sources: [rel], confidence: 1 });
    });
    res.fileSummaries += summary.length;
    res.splitters[fc.splitter] = (res.splitters[fc.splitter] ?? 0) + 1;
    if (changed || !prev[rel] || prev[rel]!.hash !== g.hash) res.changedFiles++;
    log(`${rel}: ${body.length} chunks + summary (${fc.splitter})`);
  }

  // pass 3: directory / module overviews (whole-tree runs only)
  if (!isFile) {
    const dirs = new Map<string, { files: string[]; subdirs: Set<string> }>();
    const node = (d: string) => dirs.get(d) ?? dirs.set(d, { files: [], subdirs: new Set() }).get(d)!;
    for (const g of got) {
      let d = dirOf(g.rel); node(d).files.push(g.rel);
      while (d !== ".") { const p = dirOf(d); node(p).subdirs.add(d); d = p; }
    }
    const visOf = (f: string) => byFile.get(f)?.fc.visibleTo ?? o.visibleTo ?? ["workspace"];
    const visKey = (l: string[]) => [...new Set(l)].sort().join(",");
    for (const [d, v0] of [...dirs].sort()) {
      // Privacy: a directory overview lists file names and blurbs, so it only shows what its audience can read.
      // Whole subtree with one visibility: the overview inherits it. Mixed: the overview keeps the default and lists
      // only files (and subdirs holding files) with that visibility; private files keep their own summaries and acl.
      const sub = (x: string) => got.filter((g) => x === "." || g.rel.startsWith(`${x}/`)).map((g) => g.rel);
      const keys = new Set(sub(d).map((f) => visKey(visOf(f))));
      const dirVis = keys.size === 1 ? visOf(sub(d)[0]!) : (o.visibleTo ?? ["workspace"]);
      const ok = (f: string) => visKey(visOf(f)) === visKey(dirVis);
      const v = { files: v0.files.filter(ok), subdirs: new Set([...v0.subdirs].filter((x) => sub(x).some(ok))) };
      if (!v.files.length && !v.subdirs.size) continue;
      const under = got.filter((g) => d === "." || g.rel.startsWith(`${d}/`));
      const outside = new Set<string>(), inbound = new Set<string>();
      for (const g of under) for (const x of dependsOn.get(g.rel) ?? []) if (!(d === "." || x.startsWith(`${d}/`))) outside.add(dirOf(x));
      for (const g of got) if (!(d === "." || g.rel.startsWith(`${d}/`))) for (const x of dependsOn.get(g.rel) ?? []) if (d === "." || x.startsWith(`${d}/`)) inbound.add(dirOf(g.rel));
      const lines = [
        `${d === "." ? "(repo root)" : `${d}/`} | directory overview | ${v.files.length} files here, ${under.length} files below`,
        v.subdirs.size ? `subdirectories: ${[...v.subdirs].sort().map((s) => `${s}/`).join(", ")}` : "",
        outside.size ? `depends on directories: ${[...outside].sort().join(", ")}` : "",
        inbound.size ? `used by directories: ${[...inbound].sort().join(", ")}` : "",
        "files:",
        ...v.files.sort().map((f) => { const i = byFile.get(f)!.fc.info; return `- ${f} (${i.lang})${i.about ? `: ${clip(i.about.replace(/\s+/g, " "), 160)}` : ""}${i.exports.length ? ` | ${i.lang === "markdown" ? "headings" : "exports"}: ${clip(i.exports.join(", "), 160)}` : ""}`; }),
      ].filter(Boolean);
      const chunks = emitRuns(lines, { id: "(dir)", kind: "dir", symbol: d }, [[0, lines.length - 1]], 3400)
        .map((c) => ({ ...c, ranges: undefined, text: c.part && c.part.n > 1 ? `${d}/ | directory overview (part ${c.part.n}/${c.part.of})\n${c.text}` : c.text }));
      const prel = `@dir:${d}`;
      const dirEnt = es ? ent(d === "." ? "(repo root)" : `${d}/`, "directory") : null;
      await writeChunks(prel, sha(lines.join("\n")), chunks, () => ({
        tags: [`kind-dir`, `d-${sha(d).slice(0, 10)}`, ...(d === "." ? [] : [`dir-${d.split("/")[0]}`]), ...(o.tags ?? [])],
        visibleTo: dirVis,
        extra: {
          source: { path: d, root: abs, commit: sel.commit, kind: "dir" },
          context: { kind: "dir", dir: d, files: v.files, subdirs: [...v.subdirs], dependsOnDirs: [...outside], usedByDirs: [...inbound] },
          links: { parent: d === "." ? null : keyOf(`@dir:${dirOf(d)}`, "(dir)"), children: [...v.files.map((f) => keyOf(f, "(file)")), ...[...v.subdirs].map((s) => keyOf(`@dir:${s}`, "(dir)"))] },
        },
      }), (_c, memId) => {
        if (!es || !dirEnt) return;
        es.link(memId, dirEnt, "about", 1);
        for (const f of v.files) es.relate(dirEnt, "contains", ent(f, "file"), { memoryId: memId, confidence: 1 });
        for (const s of v.subdirs) es.relate(dirEnt, "contains", ent(`${s}/`, "directory"), { memoryId: memId, confidence: 1 });
      });
      res.dirSummaries += chunks.length;
    }
  }

  // files that disappeared (only when the whole tree was listed)
  if (!isFile) for (const [rel, f] of Object.entries(prev)) if (!next[rel] && (rel.startsWith("@dir:") || !existsSync(join(root, rel)))) for (const v of Object.values(f.chunks)) { if (dry) res.retired++; else if (v.id && (await cm!.retire(v.id))) res.retired++; }
  if (!dry && mPath) {
    // keep previous entries for files that still exist but were skipped this run
    for (const [rel, f] of Object.entries(prev)) if (!next[rel] && !rel.startsWith("@dir:") && existsSync(join(root, rel)) && !res.skipped.some((s) => s.path === rel)) next[rel] = f;
    man.roots[abs] = { commit: sel.commit, at: new Date().toISOString(), files: isFile ? { ...prev, ...next } : next };
    writeFileSync(mPath, JSON.stringify(man));
  }
  return res;
}

/** Human summary of an ingest result. */
export function fmtIngest(r: IngestResult, dry: boolean): string {
  const sk: Record<string, number> = {};
  for (const s of r.skipped) sk[s.reason] = (sk[s.reason] ?? 0) + 1;
  return [
    `${dry ? "[dry-run] " : ""}root ${r.root}${r.commit ? ` @ ${r.commit.slice(0, 8)}` : ""}`,
    `files ${r.files} (changed ${r.changedFiles}), memories ${r.chunks} (file summaries ${r.fileSummaries}, dir overviews ${r.dirSummaries}, content ${r.chunks - r.fileSummaries - r.dirSummaries}; new/changed ${r.chunks - r.unchanged}, unchanged ${r.unchanged}), ${dry ? "would write" : "written"} ${dry ? r.chunks - r.unchanged : r.written}, retired ${r.retired}`,
    `links: import edges ${r.importEdges}, resolved call refs ${r.callEdges}`,
    `skipped ${r.skipped.length}${Object.keys(sk).length ? ` (${Object.entries(sk).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`,
    `est embedding tokens ${r.estTokens}; splitters ${Object.entries(r.splitters).map(([k, v]) => `${k} ${v}`).join(", ") || "none"}${treeSitterError ? `\nWARNING tree-sitter unavailable, code used the heuristic splitter: ${treeSitterError}` : ""}`,
  ].join("\n");
}
