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
        grant_id TEXT, memory_ids TEXT NOT NULL);`);
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
    const g = this.getGrant(grantId);
    if (!g || g.ownerId !== ownerId) throw new Error(`grant ${grantId} not found`);
    if (!g.revokedAt) {
      this.db.prepare(`UPDATE grants SET revoked_at=?, revoked_by=? WHERE grant_id=?`).run(iso(this.now()), by, grantId);
      this.log({ ownerId, agentId: g.agentId, action: "revoke", purpose: null, tags: g.tags, decision: "allowed",
        reason: `revoked by ${by}`, grantId, memoryIds: [] });
    }
    return this.getGrant(grantId)!;
  }

  getGrant(grantId: string): Grant | null {
    const r = this.db.prepare(`SELECT * FROM grants WHERE grant_id=?`).get(grantId) as any;
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
    const grants = this.listGrants(ownerId).filter((g) => g.agentId === req.agentId);
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
    const rows = this.db.prepare(`SELECT * FROM access_log WHERE owner_id=? ORDER BY seq`).all(ownerId) as any[];
    return rows.map((r) => ({ seq: r.seq, at: r.at, ownerId: r.owner_id, agentId: r.agent_id, action: r.action, purpose: r.purpose,
      tags: JSON.parse(r.tags), decision: r.decision, reason: r.reason, grantId: r.grant_id, memoryIds: JSON.parse(r.memory_ids) }))
      .filter((e) => !filter?.agentId || e.agentId === filter.agentId);
  }

  close(): void { this.db.close(); }

  private log(e: Omit<AccessLogEntry, "seq" | "at">): AccessLogEntry {
    const at = iso(this.now());
    const r = this.db.prepare(`INSERT INTO access_log (at, owner_id, agent_id, action, purpose, tags, decision, reason, grant_id, memory_ids)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(at, e.ownerId, e.agentId, e.action, e.purpose, JSON.stringify(e.tags), e.decision, e.reason, e.grantId, JSON.stringify(e.memoryIds));
    return { ...e, seq: Number(r.lastInsertRowid), at };
  }

  private row(r: any): Grant {
    return { grantId: r.grant_id, ownerId: r.owner_id, agentId: r.agent_id, tags: JSON.parse(r.tags), purposes: JSON.parse(r.purposes),
      consentBy: r.consent_by, consentAt: r.consent_at, expiresAt: r.expires_at, revokedAt: r.revoked_at, revokedBy: r.revoked_by };
  }
}
