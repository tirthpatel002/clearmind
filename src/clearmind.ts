// Clearmind: a memory layer you can see, correct and trust. Built on agentmemory.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { AgentMemory, SqliteStore } from "agentmemory";
import type { Embedder, Lesson, Scope } from "agentmemory";
import { AccessPolicy } from "./policy.js";
import type { AccessLogEntry, Grant } from "./policy.js";

export interface Memory {
  id: string;
  text: string;
  tags: string[];
  key: string | null;
  status: string;
  replacedBy: string | null;
  supersedes: string[];
  createdAt: string;
  score?: number | undefined;
}

export interface ClearmindOptions {
  dir: string; // data directory (memory.db + policy.db)
  ownerId: string;
  embedder?: Embedder | undefined;
  now?: (() => Date) | undefined;
}

export interface ReadResult {
  decision: "allowed" | "denied";
  reason: string;
  memories: Memory[];
  log: AccessLogEntry;
}

const toMemory = (l: Lesson): Memory => ({
  id: l.lessonId, text: l.text, tags: (l.extra.tags as string[]) ?? [], key: (l.extra.key as string) ?? null,
  status: l.status, replacedBy: l.replacedBy, supersedes: (l.extra.supersedes as string[]) ?? [], createdAt: l.createdAt,
  ...(l.score !== undefined ? { score: l.score } : {}),
});

export class Clearmind {
  readonly mem: AgentMemory;
  readonly policy: AccessPolicy;
  readonly scope: Scope;
  constructor(private opts: ClearmindOptions) {
    mkdirSync(opts.dir, { recursive: true });
    this.scope = { namespace: "clearmind", userId: opts.ownerId, agentId: "owner" };
    this.mem = new AgentMemory({
      store: new SqliteStore({ path: join(opts.dir, "memory.db") }),
      embedder: opts.embedder,
      config: { minSimilarity: 0.3, minLexicalSimilarity: 0.05, quarantine: { trialSlots: 0 } },
    });
    this.policy = new AccessPolicy(join(opts.dir, "policy.db"), opts.now);
  }

  /** Remember a fact. If `key` matches an active memory (or `supersedes` is given), the old one becomes `replaced`. */
  async remember(text: string, o: { tags?: string[]; key?: string; supersedes?: string } = {}): Promise<Memory> {
    let supersedes = o.supersedes;
    if (!supersedes && o.key) {
      const same = (await this.mem.listLessons(this.scope)).find((l) => l.extra.key === o.key);
      supersedes = same?.lessonId;
    }
    const l = await this.mem.remember(this.scope, {
      text, trigger: [o.key ?? "", ...(o.tags ?? [])].join(" ").trim(), kind: "fact", supersedes,
      extra: { tags: o.tags ?? [], ...(o.key ? { key: o.key } : {}) },
    });
    return toMemory(l);
  }

  /** Correct a memory: writes a new version and marks the old one replaced. Tags/key carry over. */
  async update(id: string, text: string): Promise<Memory> {
    const old = await this.mem.current(this.scope, id);
    return this.remember(text, { tags: (old.extra.tags as string[]) ?? [], key: (old.extra.key as string) ?? undefined, supersedes: old.lessonId });
  }

  async recall(query: string, k = 5, tags?: string[]): Promise<Memory[]> {
    const got = (await this.mem.recall(this.scope, query, 50)).map(toMemory);
    return got.filter((m) => !tags || tags.includes("*") || m.tags.some((t) => tags.includes(t))).slice(0, k);
  }

  async list(includeReplaced = false): Promise<Memory[]> {
    return (await this.mem.listLessons(this.scope, { status: includeReplaced ? ["active", "replaced"] : ["active"] })).map(toMemory);
  }

  async history(id: string): Promise<Memory[]> { return (await this.mem.history(this.scope, id)).map(toMemory); }

  grant(g: { agentId: string; tags: string[]; purposes: string[]; consentBy: string; ttlMs?: number | null }): Grant {
    return this.policy.grant(this.opts.ownerId, g);
  }

  revoke(grantId: string, by: string): Grant { return this.policy.revoke(this.opts.ownerId, grantId, by); }

  /** An agent reads memories. Purpose is required; every attempt is logged. */
  async read(req: { agentId: string; purpose?: string | null; tags?: string[]; query: string; k?: number }): Promise<ReadResult> {
    const c = this.policy.check(this.opts.ownerId, req);
    const memories = c.decision === "allowed" ? await this.recall(req.query, req.k ?? 5, c.tags) : [];
    const log = this.policy.record(this.opts.ownerId, req, c, memories.map((m) => m.id));
    return { decision: c.decision, reason: c.reason, memories, log };
  }

  accessLog(agentId?: string): AccessLogEntry[] { return this.policy.accessLog(this.opts.ownerId, agentId ? { agentId } : undefined); }

  async close(): Promise<void> { this.policy.close(); await this.mem.close(); }
}
