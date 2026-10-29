// Access policy for Clearmind: scoped grants, required purpose, expiry, consent, access log, revoke.
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";

export interface Grant {
  grantId: string;
  ownerId: string;
  agentId: string; // who may read
  tags: string[]; // memory scopes the agent may see, e.g. ["work"]; "*" = all
  purposes: string[]; // allowed purposes; "*" = any non-empty purpose
  consentBy: string; // who consented (required)
  consentAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
}

export type Decision = "allowed" | "denied";

export interface AccessLogEntry {
  seq: number;
  at: string;
  ownerId: string;
  agentId: string;
  action: "read" | "grant" | "revoke";
  purpose: string | null;
  tags: string[];
  decision: Decision;
  reason: string;
  grantId: string | null;
  memoryIds: string[];
}

export interface AccessRequest {
  agentId: string;
  purpose?: string | null | undefined;
  tags?: string[] | undefined; // scopes requested; default = all the grant allows
}

export interface PolicyCheck {
  decision: Decision;
  reason: string;
  grant: Grant | null;
  tags: string[]; // effective scopes
}

const iso = (d: Date) => d.toISOString();
const logRow = (r: any): AccessLogEntry => ({ seq: r.seq, at: r.at, ownerId: r.owner_id, agentId: r.agent_id, action: r.action, purpose: r.purpose,
  tags: JSON.parse(r.tags), decision: r.decision, reason: r.reason, grantId: r.grant_id, memoryIds: JSON.parse(r.memory_ids) });

export class AccessPolicy {
  private db: DatabaseSync;
  constructor(path: string, private now: () => Date = () => new Date()) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS grants (
        grant_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, agent_id TEXT NOT NULL,
        tags TEXT NOT NULL, purposes TEXT NOT NULL, consent_by TEXT NOT NULL, consent_at TEXT NOT NULL,
        expires_at TEXT, revoked_at TEXT, revoked_by TEXT);
      CREATE TABLE IF NOT EXISTS access_log (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, owner_id TEXT NOT NULL, agent_id TEXT NOT NULL,
        action TEXT NOT NULL, purpose TEXT, tags TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL,
        grant_id TEXT, memory_ids TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS agents (owner_id TEXT NOT NULL, agent_id TEXT NOT NULL, PRIMARY KEY (owner_id, agent_id));
      CREATE TABLE IF NOT EXISTS scopes (owner_id TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (owner_id, name));
      CREATE INDEX IF NOT EXISTS idx_grants_owner ON grants(owner_id, agent_id, consent_at);
      CREATE INDEX IF NOT EXISTS idx_log_owner_seq ON access_log(owner_id, seq);
      CREATE INDEX IF NOT EXISTS idx_log_owner_action_at ON access_log(owner_id, action, at);
      CREATE INDEX IF NOT EXISTS idx_log_owner_agent ON access_log(owner_id, agent_id, seq);`);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;");
  }

  grant(ownerId: string, g: { agentId: string; tags: string[]; purposes: string[]; consentBy: string; ttlMs?: number | null }): Grant {
    if (!g.agentId?.trim()) throw new Error("grant needs agentId");
    if (!g.consentBy?.trim()) throw new Error("grant needs explicit consent (consentBy)");
    if (!g.tags?.length) throw new Error("grant needs at least one scope tag");
    if (!g.purposes?.length || g.purposes.some((p) => !p.trim())) throw new Error("grant needs at least one purpose");
    const now = this.now();
    const grant: Grant = {
      grantId: `grt_${randomUUID().slice(0, 8)}`, ownerId, agentId: g.agentId, tags: g.tags, purposes: g.purposes,
      consentBy: g.consentBy, consentAt: iso(now), expiresAt: g.ttlMs ? iso(new Date(now.getTime() + g.ttlMs)) : null,
      revokedAt: null, revokedBy: null,
    };
    this.db.prepare(`INSERT INTO grants VALUES (?,?,?,?,?,?,?,?,?,?)`).run(grant.grantId, ownerId, grant.agentId,
      JSON.stringify(grant.tags), JSON.stringify(grant.purposes), grant.consentBy, grant.consentAt, grant.expiresAt, null, null);
    this.log({ ownerId, agentId: g.agentId, action: "grant", purpose: null, tags: g.tags, decision: "allowed",
      reason: `granted by ${g.consentBy} for purposes [${g.purposes.join(", ")}]${grant.expiresAt ? ` until ${grant.expiresAt}` : ""}`,
      grantId: grant.grantId, memoryIds: [] });
    return grant;
  }

  revoke(ownerId: string, grantId: string, by: string): Grant {
    const g = this.getGrant(grantId, ownerId);
    if (!g) throw new Error(`grant ${grantId} not found`);
    if (!g.revokedAt) {
      this.db.prepare(`UPDATE grants SET revoked_at=?, revoked_by=? WHERE grant_id=?`).run(iso(this.now()), by, grantId);
      this.log({ ownerId, agentId: g.agentId, action: "revoke", purpose: null, tags: g.tags, decision: "allowed",
        reason: `revoked by ${by}`, grantId, memoryIds: [] });
    }
    return this.getGrant(grantId)!;
  }

  getGrant(grantId: string, ownerId?: string): Grant | null {
    const r = (ownerId ? this.db.prepare(`SELECT * FROM grants WHERE grant_id=? AND owner_id=?`).get(grantId, ownerId)
      : this.db.prepare(`SELECT * FROM grants WHERE grant_id=?`).get(grantId)) as any;
    return r ? this.row(r) : null;
  }

  listGrants(ownerId: string): Grant[] {
    return (this.db.prepare(`SELECT * FROM grants WHERE owner_id=? ORDER BY consent_at`).all(ownerId) as any[]).map((r) => this.row(r));
  }

  /** Decide a read; does not log (call record() with the outcome). */
  check(ownerId: string, req: AccessRequest): PolicyCheck {
    const purpose = req.purpose?.trim() ?? "";
    if (!purpose) return { decision: "denied", reason: "no purpose given (purpose is required on every read)", grant: null, tags: [] };
    const now = this.now().getTime();
    const grants = (this.db.prepare(`SELECT * FROM grants WHERE owner_id=? AND agent_id=? ORDER BY consent_at`).all(ownerId, req.agentId) as any[]).map((r) => this.row(r));
    if (!grants.length) return { decision: "denied", reason: `no grant for agent ${req.agentId}`, grant: null, tags: [] };
    let why = "";
    for (const g of grants.reverse()) {
      if (g.revokedAt) { why ||= `grant ${g.grantId} was revoked at ${g.revokedAt}`; continue; }
      if (g.expiresAt && Date.parse(g.expiresAt) <= now) { why ||= `grant ${g.grantId} expired at ${g.expiresAt}`; continue; }
      if (!g.purposes.includes("*") && !g.purposes.includes(purpose)) { why ||= `purpose "${purpose}" not in grant ${g.grantId} [${g.purposes.join(", ")}]`; continue; }
      const all = g.tags.includes("*");
      const asked = req.tags?.length ? req.tags : g.tags;
      const outside = all ? [] : asked.filter((t) => !g.tags.includes(t));
      if (outside.length) { why ||= `scope [${outside.join(", ")}] not in grant ${g.grantId} [${g.tags.join(", ")}]`; continue; }
      return { decision: "allowed", reason: `grant ${g.grantId}, consent by ${g.consentBy}`, grant: g, tags: asked };
    }
    return { decision: "denied", reason: why, grant: null, tags: [] };
  }

  record(ownerId: string, req: AccessRequest, c: PolicyCheck, memoryIds: string[]): AccessLogEntry {
    return this.log({ ownerId, agentId: req.agentId, action: "read", purpose: req.purpose?.trim() || null, tags: req.tags ?? c.tags,
      decision: c.decision, reason: c.reason, grantId: c.grant?.grantId ?? null, memoryIds });
  }

  accessLog(ownerId: string, filter?: { agentId?: string }): AccessLogEntry[] {
    const rows = (filter?.agentId ? this.db.prepare(`SELECT * FROM access_log WHERE owner_id=? AND agent_id=? ORDER BY seq`).all(ownerId, filter.agentId)
      : this.db.prepare(`SELECT * FROM access_log WHERE owner_id=? ORDER BY seq`).all(ownerId)) as any[];
    return rows.map(logRow);
  }

  /** Newest first, keyset-paginated by seq. q matches agent, purpose, reason or scope. */
  logPage(ownerId: string, o: { limit?: number; cursor?: number | null; q?: string; scope?: string; agentId?: string; decision?: string; action?: string } = {}): { items: AccessLogEntry[]; nextCursor: number | null } {
    const limit = Math.min(200, Math.max(1, o.limit ?? 50));
    let sql = `SELECT * FROM access_log WHERE owner_id=?`; const p: (string | number)[] = [ownerId];
    if (o.cursor) { sql += ` AND seq < ?`; p.push(o.cursor); }
    if (o.agentId) { sql += ` AND agent_id = ?`; p.push(o.agentId); }
    if (o.decision) { sql += ` AND decision = ?`; p.push(o.decision); }
    if (o.action) { sql += ` AND action = ?`; p.push(o.action); }
    if (o.scope) { sql += ` AND tags LIKE ?`; p.push(`%"${o.scope.replace(/[%_"]/g, "")}"%`); }
    if (o.q) { const like = `%${o.q.replace(/[%_]/g, "")}%`; sql += ` AND (agent_id LIKE ? OR purpose LIKE ? OR reason LIKE ? OR tags LIKE ?)`; p.push(like, like, like, like); }
    sql += ` ORDER BY seq DESC LIMIT ?`; p.push(limit + 1);
    const rows = (this.db.prepare(sql).all(...p) as any[]).map(logRow);
    const more = rows.length > limit; const items = rows.slice(0, limit);
    return { items, nextCursor: more ? items.at(-1)!.seq : null };
  }

  /** Aggregates for the dashboard, computed in SQL. Day buckets use the client's UTC offset (minutes). */
  logStats(ownerId: string, o: { days?: number; tzOffsetMin?: number; now?: Date } = {}) {
    const days = Math.min(90, o.days ?? 14), off = Math.round(o.tzOffsetMin ?? 0), now = o.now ?? this.now();
    const since = new Date(now.getTime() - (days + 1) * 864e5).toISOString();
    const totals = this.db.prepare(`SELECT decision, COUNT(*) n FROM access_log WHERE owner_id=? AND action='read' AND agent_id<>'owner' GROUP BY decision`).all(ownerId) as any[];
    const buckets = this.db.prepare(`SELECT date(at, ? ) d, decision, COUNT(*) n FROM access_log WHERE owner_id=? AND action='read' AND agent_id<>'owner' AND at >= ? GROUP BY d, decision`)
      .all(`${off >= 0 ? "+" : ""}${off} minutes`, ownerId, since) as any[];
    const revoked = (this.db.prepare(`SELECT COUNT(*) n FROM grants WHERE owner_id=? AND revoked_at IS NOT NULL`).get(ownerId) as any).n as number;
    const nowIso = now.toISOString();
    const active = (this.db.prepare(`SELECT COUNT(*) n FROM grants WHERE owner_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)`).get(ownerId, nowIso) as any).n as number;
    const grants = (this.db.prepare(`SELECT COUNT(*) n FROM grants WHERE owner_id=?`).get(ownerId) as any).n as number;
    const t = Object.fromEntries(totals.map((r) => [r.decision, r.n]));
    const byDay: Record<string, { allowed: number; denied: number }> = {};
    for (const r of buckets) (byDay[r.d] ??= { allowed: 0, denied: 0 })[r.decision as "allowed" | "denied"] = r.n;
    return { readsAllowed: t.allowed ?? 0, readsDenied: t.denied ?? 0, byDay, grants, activeGrants: active, revokedGrants: revoked };
  }

  addScope(ownerId: string, name: string): void { this.db.prepare(`INSERT OR IGNORE INTO scopes VALUES (?,?,?)`).run(ownerId, name, iso(this.now())); }
  scopes(ownerId: string): string[] { return (this.db.prepare(`SELECT name FROM scopes WHERE owner_id=? ORDER BY created_at, name`).all(ownerId) as any[]).map((r) => r.name); }

  noteAgent(ownerId: string, agentId: string): void { this.db.prepare(`INSERT OR IGNORE INTO agents VALUES (?,?)`).run(ownerId, agentId); }
  agents(ownerId: string): string[] {
    const a = (this.db.prepare(`SELECT agent_id FROM agents WHERE owner_id=?`).all(ownerId) as any[]).map((r) => r.agent_id as string);
    const g = (this.db.prepare(`SELECT DISTINCT agent_id FROM grants WHERE owner_id=?`).all(ownerId) as any[]).map((r) => r.agent_id as string);
    return [...new Set([...a, ...g])].sort();
  }

  close(): void { this.db.close(); }

  private log(e: Omit<AccessLogEntry, "seq" | "at">): AccessLogEntry {
    const at = iso(this.now());
    const r = this.db.prepare(`INSERT INTO access_log (at, owner_id, agent_id, action, purpose, tags, decision, reason, grant_id, memory_ids)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(at, e.ownerId, e.agentId, e.action, e.purpose, JSON.stringify(e.tags), e.decision, e.reason, e.grantId, JSON.stringify(e.memoryIds));
    return { ...e, seq: Number(r.lastInsertRowid), at };
  }

  listGrantsPage(ownerId: string, limit = 100): Grant[] {
    return (this.db.prepare(`SELECT * FROM grants WHERE owner_id=? ORDER BY consent_at DESC LIMIT ?`).all(ownerId, limit) as any[]).map((r) => this.row(r));
  }

  private row(r: any): Grant {
    return { grantId: r.grant_id, ownerId: r.owner_id, agentId: r.agent_id, tags: JSON.parse(r.tags), purposes: JSON.parse(r.purposes),
      consentBy: r.consent_by, consentAt: r.consent_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, revokedBy: r.revoked_by };
  }
}
