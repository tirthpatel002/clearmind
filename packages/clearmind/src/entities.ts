// Entities: anything with a name that memories mention. Universal by design: an entity is a name, aliases, an optional
// free-string type and an open map of fields. Types, field names and relation predicates are plain data; nothing here
// knows any domain. Every field value keeps provenance (sources, fetchedAt, memoryIds); a changed value supersedes the
// old row (status 'replaced', replaced_by), so history stays readable. One SQLite file (entities.db) per data dir.
import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";

export interface Provenance { sources?: string[]; fetchedAt?: string | null; memoryIds?: string[] }
export interface EntityField { id: string; field: string; value: unknown; sources: string[]; fetchedAt: string | null; memoryIds: string[]; status: "active" | "replaced"; replacedBy: string | null; createdAt: string }
export interface Entity { id: string; name: string; type: string | null; aliases: string[]; createdAt: string; updatedAt: string; memoryCount?: number }
export interface EntityLink { memoryId: string; entityId: string; role: string; confidence: number }
export interface EntityRelation { from: string; predicate: string; to: string; memoryId: string | null; sources: string[]; confidence: number }
export interface EntityDetail extends Entity { fields: Record<string, EntityField>; history: EntityField[]; memoryIds: string[]; relations: EntityRelation[] }

/** Alias key: Unicode-normalised, lowercased, punctuation folded, a trailing possessive dropped. */
export function aliasKey(name: string): string {
  return name.normalize("NFKC").replace(/[’']s$/i, "").replace(/[^\p{L}\p{N}&+ ]+/gu, " ").replace(/\s+/g, " ").trim().toLowerCase();
}
const uid = (p: string, s: string) => p + createHash("sha1").update(s).digest("hex").slice(0, 12);
const J = (s: string | null | undefined, d: any) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uniq = <T,>(xs: T[]) => [...new Set(xs.filter((x) => x !== undefined && x !== null && x !== ""))];
const N = `(SELECT COUNT(*) FROM memory_entities m WHERE m.entity_id=e.id) n`;

export class EntityStore {
  private d: DatabaseSync;
  private st = new Map<string, StatementSync>();
  constructor(path: string, private user: string, private clock: () => Date = () => new Date()) {
    this.d = new DatabaseSync(path);
    this.d.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS entities (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT,
        embedding BLOB, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_ent_type ON entities(user_id, type);
      CREATE TABLE IF NOT EXISTS entity_aliases (user_id TEXT NOT NULL, key TEXT NOT NULL, alias TEXT NOT NULL, entity_id TEXT NOT NULL, PRIMARY KEY (user_id, key));
      CREATE INDEX IF NOT EXISTS idx_alias_ent ON entity_aliases(entity_id);
      CREATE TABLE IF NOT EXISTS entity_fields (id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL,
        sources TEXT NOT NULL DEFAULT '[]', fetched_at TEXT, memory_ids TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active',
        replaced_by TEXT, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS idx_ef ON entity_fields(entity_id, field, status);
      CREATE INDEX IF NOT EXISTS idx_ef_field ON entity_fields(field, status);
      CREATE TABLE IF NOT EXISTS memory_entities (memory_id TEXT NOT NULL, entity_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'mention',
        confidence REAL NOT NULL DEFAULT 0.6, PRIMARY KEY (memory_id, entity_id));
      CREATE INDEX IF NOT EXISTS idx_me_e ON memory_entities(entity_id);
      CREATE TABLE IF NOT EXISTS entity_relations (from_id TEXT NOT NULL, predicate TEXT NOT NULL, to_id TEXT NOT NULL, memory_id TEXT,
        sources TEXT NOT NULL DEFAULT '[]', confidence REAL NOT NULL DEFAULT 0.6, PRIMARY KEY (from_id, predicate, to_id));
      CREATE INDEX IF NOT EXISTS idx_rel_to ON entity_relations(to_id);`);
  }
  /** Run synchronous writes in one transaction (one commit instead of one per statement). Nested calls join the outer one. */
  tx<T>(fn: () => T): T {
    if (this.inTx) return fn();
    this.inTx = true; this.d.exec("BEGIN");
    try { const r = fn(); this.d.exec("COMMIT"); return r; } catch (e) { this.d.exec("ROLLBACK"); throw e; } finally { this.inTx = false; }
  }
  private inTx = false;
  private q(sql: string): StatementSync { let s = this.st.get(sql); if (!s) this.st.set(sql, (s = this.d.prepare(sql))); return s; }
  private iso() { return this.clock().toISOString(); }
  private row(r: any): Entity {
    const aliases = (this.q(`SELECT alias FROM entity_aliases WHERE entity_id=?`).all(r.id) as any[]).map((a) => a.alias).filter((a) => a !== r.name);
    return { id: r.id, name: r.name, type: r.type ?? null, aliases, createdAt: r.created_at, updatedAt: r.updated_at, ...(r.n != null ? { memoryCount: Number(r.n) } : {}) };
  }

  /** Find by name or any alias: one indexed lookup. */
  resolve(name: string): Entity | null {
    const k = aliasKey(name); if (!k) return null;
    const r = this.q(`SELECT e.* FROM entity_aliases a JOIN entities e ON e.id=a.entity_id WHERE a.user_id=? AND a.key=?`).get(this.user, k) as any;
    return r ? this.row(r) : null;
  }
  /** Id only (hot path for linking). */
  resolveId(name: string): string | null {
    const k = aliasKey(name); if (!k) return null;
    return ((this.q(`SELECT entity_id FROM entity_aliases WHERE user_id=? AND key=?`).get(this.user, k) as any)?.entity_id as string) ?? null;
  }
  /** Entities whose name or alias starts with this word ("Ada" -> "Ada Lovelace"): an indexed range scan, at most 2. */
  byFirstWord(word: string): string[] {
    const k = aliasKey(word); if (!k || k.includes(" ")) return [];
    return [...new Set((this.q(`SELECT entity_id FROM entity_aliases WHERE user_id=? AND key>=? AND key<? LIMIT 8`).all(this.user, k + " ", k + "!") as any[]).map((r) => r.entity_id as string))].slice(0, 2);
  }
  /** Create or merge by name (or an alias already registered). New aliases attach if free; a type is set when missing or given. */
  upsert(name: string, type: string | null = null, aliases: string[] = []): Entity {
    name = name.trim(); if (!name) throw new Error("entity name is empty");
    const t = this.iso();
    let id = this.resolveId(name);
    if (!id) {
      id = uid("ent_", `${this.user}\n${aliasKey(name)}`);
      this.q(`INSERT OR IGNORE INTO entities (id,user_id,name,type,created_at,updated_at) VALUES (?,?,?,?,?,?)`).run(id, this.user, name, type, t, t);
    } else if (type) this.q(`UPDATE entities SET type=?, updated_at=?, embedding=NULL WHERE id=? AND (type IS NULL OR type!=?)`).run(type, t, id, type);
    for (const a of uniq([name, ...aliases.map((s) => s.trim())])) {
      const k = aliasKey(a);
      if (k && this.q(`INSERT OR IGNORE INTO entity_aliases (user_id,key,alias,entity_id) VALUES (?,?,?,?)`).run(this.user, k, a, id).changes) this.q(`UPDATE entities SET embedding=NULL WHERE id=?`).run(id);
    }
    return this.get(id)!;
  }
  get(id: string): Entity | null {
    const r = this.q(`SELECT e.*, ${N} FROM entities e WHERE id=? AND user_id=?`).get(id, this.user) as any;
    return r ? this.row(r) : null;
  }
  /** Paginated list, most-linked first. q matches name/alias keys (prefix or substring), type is exact. */
  list(o: { type?: string; q?: string; limit?: number; offset?: number; only?: string[] } = {}): Entity[] {
    const w: string[] = ["e.user_id=?"], p: any[] = [this.user];
    if (o.only) { w.push("e.id IN (SELECT value FROM json_each(?))"); p.push(JSON.stringify(o.only)); }
    if (o.type) { w.push("e.type=?"); p.push(o.type); }
    if (o.q) { w.push(`e.id IN (SELECT entity_id FROM entity_aliases WHERE user_id=? AND key LIKE ?)`); p.push(this.user, `%${aliasKey(o.q)}%`); }
    p.push(Math.min(o.limit ?? 100, 10_000), o.offset ?? 0);
    return (this.q(`SELECT e.*, ${N} FROM entities e WHERE ${w.join(" AND ")} ORDER BY n DESC, e.name LIMIT ? OFFSET ?`).all(...p) as any[]).map((r) => this.row(r));
  }
  /** Set any field. Same value: provenance merges. Different value: the old row is superseded, never overwritten. */
  setField(entityId: string, field: string, value: unknown, p: Provenance = {}): EntityField {
    const t = this.iso();
    const cur = this.q(`SELECT * FROM entity_fields WHERE entity_id=? AND field=? AND status='active'`).get(entityId, field) as any;
    if (cur && same(J(cur.value, null), value)) {
      this.q(`UPDATE entity_fields SET sources=?, memory_ids=?, fetched_at=COALESCE(?, fetched_at) WHERE id=?`)
        .run(JSON.stringify(uniq([...J(cur.sources, []), ...(p.sources ?? [])])), JSON.stringify(uniq([...J(cur.memory_ids, []), ...(p.memoryIds ?? [])])), p.fetchedAt ?? null, cur.id);
      return this.fieldRow(this.q(`SELECT * FROM entity_fields WHERE id=?`).get(cur.id));
    }
    const id = uid("ef_", `${entityId}\n${field}\n${t}\n${Math.random()}`);
    this.q(`INSERT INTO entity_fields (id,entity_id,field,value,sources,fetched_at,memory_ids,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .run(id, entityId, field, JSON.stringify(value), JSON.stringify(uniq(p.sources ?? [])), p.fetchedAt ?? null, JSON.stringify(uniq(p.memoryIds ?? [])), t);
    if (cur) this.q(`UPDATE entity_fields SET status='replaced', replaced_by=? WHERE id=?`).run(id, cur.id);
    this.q(`UPDATE entities SET updated_at=?, embedding=NULL WHERE id=?`).run(t, entityId);
    return this.fieldRow(this.q(`SELECT * FROM entity_fields WHERE id=?`).get(id));
  }
  private fieldRow(r: any): EntityField {
    return { id: r.id, field: r.field, value: J(r.value, null), sources: J(r.sources, []), fetchedAt: r.fetched_at, memoryIds: J(r.memory_ids, []), status: r.status, replacedBy: r.replaced_by, createdAt: r.created_at };
  }
  fields(entityId: string, withHistory = false): EntityField[] {
    return (this.q(`SELECT * FROM entity_fields WHERE entity_id=? ${withHistory ? "" : "AND status='active'"} ORDER BY created_at`).all(entityId) as any[]).map((r) => this.fieldRow(r));
  }
  link(memoryId: string, entityId: string, role = "mention", confidence = 0.6): void {
    this.q(`INSERT INTO memory_entities (memory_id,entity_id,role,confidence) VALUES (?,?,?,?) ON CONFLICT(memory_id,entity_id) DO UPDATE SET confidence=MAX(confidence,excluded.confidence),
      role=CASE WHEN excluded.role!='mention' THEN excluded.role ELSE role END`).run(memoryId, entityId, role, confidence);
  }
  /** Generic relation: any predicate string, with provenance. */
  relate(from: string, predicate: string, to: string, p: { memoryId?: string | null; sources?: string[]; confidence?: number } = {}): void {
    if (from === to || !predicate.trim()) return;
    const cur = this.q(`SELECT sources FROM entity_relations WHERE from_id=? AND predicate=? AND to_id=?`).get(from, predicate, to) as any;
    if (cur) this.q(`UPDATE entity_relations SET sources=?, confidence=MAX(confidence,?), memory_id=COALESCE(memory_id,?) WHERE from_id=? AND predicate=? AND to_id=?`).run(JSON.stringify(uniq([...J(cur.sources, []), ...(p.sources ?? [])])), p.confidence ?? 0.6, p.memoryId ?? null, from, predicate, to);
    else this.q(`INSERT INTO entity_relations (from_id,predicate,to_id,memory_id,sources,confidence) VALUES (?,?,?,?,?,?)`).run(from, predicate.trim(), to, p.memoryId ?? null, JSON.stringify(uniq(p.sources ?? [])), p.confidence ?? 0.6);
  }
  memoriesOf(entityId: string): string[] { return (this.q(`SELECT memory_id FROM memory_entities WHERE entity_id=? ORDER BY confidence DESC`).all(entityId) as any[]).map((r) => r.memory_id); }
  links(): EntityLink[] {
    return (this.q(`SELECT m.* FROM memory_entities m JOIN entities e ON e.id=m.entity_id WHERE e.user_id=?`).all(this.user) as any[]).map((r) => ({ memoryId: r.memory_id, entityId: r.entity_id, role: r.role, confidence: r.confidence }));
  }
  relations(entityId?: string): EntityRelation[] {
    const rs = (entityId ? this.q(`SELECT * FROM entity_relations WHERE from_id=? UNION SELECT * FROM entity_relations WHERE to_id=?`).all(entityId, entityId)
      : this.q(`SELECT r.* FROM entity_relations r JOIN entities e ON e.id=r.from_id WHERE e.user_id=?`).all(this.user)) as any[];
    return rs.map((r) => ({ from: r.from_id, predicate: r.predicate, to: r.to_id, memoryId: r.memory_id, sources: J(r.sources, []), confidence: r.confidence }));
  }
  detail(id: string): EntityDetail | null {
    const e = this.get(id); if (!e) return null;
    const h = this.fields(id, true);
    return { ...e, fields: Object.fromEntries(h.filter((f) => f.status === "active").map((f) => [f.field, f])), history: h.filter((f) => f.status === "replaced"), memoryIds: this.memoriesOf(id), relations: this.relations(id) };
  }
  /** Text embedded for semantic entity search: name, aliases, type and every active field. */
  profileText(id: string): string {
    const d = this.detail(id); if (!d) return "";
    const v = (x: unknown): string => (typeof x === "string" ? x : Array.isArray(x) ? x.map(v).join(", ") : x && typeof x === "object" ? Object.entries(x).map(([k, y]) => `${k} ${v(y)}`).join(", ") : String(x ?? ""));
    const f = Object.values(d.fields).map((x) => `${x.field}: ${v(x.value)}`).join(". ");
    return `${d.name}${d.aliases.length ? ` (also ${d.aliases.join(", ")})` : ""}${d.type ? `, ${d.type}` : ""}. ${f}`.slice(0, 1500);
  }
  setEmbedding(id: string, v: Float32Array) { this.q(`UPDATE entities SET embedding=? WHERE id=?`).run(new Uint8Array(v.buffer, v.byteOffset, v.byteLength), id); }
  embeddings(): { id: string; v: Float32Array | null }[] {
    return (this.q(`SELECT id, embedding FROM entities WHERE user_id=?`).all(this.user) as any[]).map((r) => ({ id: r.id, v: r.embedding ? new Float32Array(Uint8Array.from(r.embedding).buffer) : null }));
  }
  unlinkMemory(memoryId: string) { this.q(`DELETE FROM memory_entities WHERE memory_id=?`).run(memoryId); this.q(`UPDATE entity_relations SET memory_id=NULL WHERE memory_id=?`).run(memoryId); }
  /** Delete the entity with its fields, aliases, links and relations. Returns the memories that were linked. */
  remove(id: string): string[] {
    const mem = this.memoriesOf(id);
    for (const s of [`DELETE FROM memory_entities WHERE entity_id=?`, `DELETE FROM entity_fields WHERE entity_id=?`, `DELETE FROM entity_aliases WHERE entity_id=?`, `DELETE FROM entities WHERE id=?`]) this.q(s).run(id);
    this.q(`DELETE FROM entity_relations WHERE from_id=? OR to_id=?`).run(id, id);
    return mem;
  }
  /** Entities whose type or any active field value contains the text (case-insensitive). */
  searchText(text: string, limit = 20): string[] {
    const k = `%${text.trim().toLowerCase()}%`; if (k.length < 4) return [];
    return (this.q(`SELECT id FROM entities WHERE user_id=? AND lower(type) LIKE ? UNION SELECT f.entity_id FROM entity_fields f JOIN entities e ON e.id=f.entity_id WHERE e.user_id=? AND f.status='active' AND lower(f.value) LIKE ? LIMIT ?`).all(this.user, k, this.user, k, limit) as any[]).map((r) => r.id);
  }
  /** Entity count per type (untyped entities count under ""). Types are whatever the data says. */
  counts(): Record<string, number> {
    const o: Record<string, number> = {};
    for (const r of this.q(`SELECT COALESCE(type,'') t, COUNT(*) n FROM entities WHERE user_id=? GROUP BY t`).all(this.user) as any[]) o[r.t] = Number(r.n);
    return o;
  }
  total(): number { return Number((this.q(`SELECT COUNT(*) n FROM entities WHERE user_id=?`).get(this.user) as any).n); }
  close() { this.d.close(); }
}
