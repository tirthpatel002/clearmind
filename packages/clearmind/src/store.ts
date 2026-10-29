// Clearmind: a memory layer you can see, correct and trust. Built on agentmemory.
// One instance serves one user; every query is scoped to that user.
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { AgentMemory, HybridRetriever, SqliteStore } from "agentmemory";
import type { Embedder, EventInput, Lesson, LLM, Outcome, Scope } from "agentmemory";
import { answerability, cosineSim, isNoMemoryReply, lexicalCoverage, NO_MEMORY } from "./abstain.js";
import { DEFAULTS, validUserId } from "./config.js";
import type { Config } from "./config.js";
import { parseImport } from "./importer.js";
import { confirmConfidence, detectConflicts, detectPatterns, effectiveConfidence, findDuplicate } from "./learning.js";
import type { Fact } from "./learning.js";
import { AccessPolicy } from "./policy.js";
import { ASK_SYSTEM, extractSystem, TITLE_SYSTEM } from "./prompts.js";
import { hasNebiusKey, nebiusProvider } from "./providers/nebius.js";
import type { ChatFn } from "./providers/provider.js";
import { normScope } from "./scopes.js";
import { SpendLedger } from "./spend.js";
import { cleanTitle, heuristicTitle, readTitles, titleKey, writeTitles } from "./titles.js";
import type {
  AccessLogEntry, AskResult, Conflict, ExtractedFact, Grant, Graph, GraphEdges, ImportFormat, ImportResult,
  Insights, Memory, MemoryPage, MemoryStats, MemoryStatusFilter, Pattern, ReadResult, TitledPattern,
} from "./types.js";

export interface ClearmindOptions {
  /** Override the system prompt used by ask() (default ANSWER_PROMPT). */
  answerPrompt?: string | undefined;
  dir: string;
  ownerId: string;
  embedder?: Embedder | undefined;
  /** Answers (ask), extraction and pattern titles. */
  chat?: ChatFn | undefined;
  /** Distiller for agent lessons. */
  llm?: LLM | undefined;
  now?: (() => Date) | undefined;
  /** Hybrid recall threshold (overrides config.recall.minSimilarity). */
  minSimilarity?: number | undefined;
  /** Overrides config.confidence.halfLifeDays. */
  halfLifeDays?: number | undefined;
  config?: Config | undefined;
  ledger?: SpendLedger | undefined;
}

export interface RecallEvidence {
  memories: Memory[];
  evidence: number;
  cosine: number | null;
  lexical: number;
  abstained: boolean;
  candidates: Memory[];
}

/** Above this many memories, insights compute in the background and a stale result is served. */
const INSIGHTS_SYNC_LIMIT = 2000;
/** Max model calls per titling pass. */
const MAX_TITLE_CALLS = 20;
const AGENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export class Clearmind {
  readonly mem: AgentMemory;
  readonly lessonsMem: AgentMemory;
  readonly policy: AccessPolicy;
  readonly scope: Scope;
  readonly ledger: SpendLedger | null;
  readonly cfg: Config;
  private now: () => Date;
  private sql: DatabaseSync | null = null;
  private statsCache: { key: string; value: MemoryStats } | null = null;
  private insightCache: { sig: string; value: Insights } | null = null;
  private insightJob: Promise<Insights> | null = null;
  private titling = false;

  constructor(private opts: ClearmindOptions) {
    if (!validUserId(opts.ownerId)) throw new Error(`invalid user id "${opts.ownerId}"`);
    mkdirSync(opts.dir, { recursive: true });
    this.cfg = opts.config ?? DEFAULTS;
    this.now = opts.now ?? (() => new Date());
    this.scope = { namespace: "clearmind", userId: opts.ownerId, agentId: "owner" };
    const minSimilarity = opts.minSimilarity ?? this.cfg.recall.minSimilarity;
    const minLexicalSimilarity = this.cfg.recall.minLexicalSimilarity;
    this.mem = new AgentMemory({
      store: new SqliteStore({ path: join(opts.dir, "memory.db") }),
      embedder: opts.embedder,
      retriever: new HybridRetriever({ now: this.now }),
      config: { minSimilarity, minLexicalSimilarity, quarantine: { trialSlots: 0 } },
    });
    this.lessonsMem = new AgentMemory({
      store: new SqliteStore({ path: join(opts.dir, "lessons.db") }),
      embedder: opts.embedder,
      llm: opts.llm,
      retriever: new HybridRetriever({ now: this.now }),
      config: { minSimilarity, minLexicalSimilarity },
    });
    this.policy = new AccessPolicy(join(opts.dir, "policy.db"), opts.now);
    this.ledger = opts.ledger ?? null;
  }

  /**
   * Build for one user. Uses the Nebius provider (Nemotron chat + Qwen3 embeddings) when the API key
   * env var named in config is set, unless offline. Spend is metered per user.
   */
  static fromEnv(
    dir: string,
    ownerId: string,
    o: { offline?: boolean; now?: () => Date; config?: Config; ledger?: SpendLedger } = {},
  ): Clearmind {
    const cfg = o.config ?? DEFAULTS;
    const online = !o.offline && hasNebiusKey(cfg);
    mkdirSync(dir, { recursive: true });
    const ledger = o.ledger ?? new SpendLedger(join(dir, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
    const provider = online ? nebiusProvider(ledger, cfg, ownerId) : null;
    return new Clearmind({
      dir, ownerId, config: cfg, ledger, now: o.now,
      embedder: provider?.embedder, chat: provider?.chat, llm: provider?.llm,
    });
  }

  get userId(): string {
    return this.opts.ownerId;
  }

  get online(): boolean {
    return !!this.opts.chat;
  }

  // ----- internals -----

  /** Direct read access to memory.db for paging and aggregates (always filtered by this user's scope). */
  private async db(): Promise<DatabaseSync> {
    if (this.sql) return this.sql;
    await this.mem.init();
    this.sql = new DatabaseSync(join(this.opts.dir, "memory.db"));
    this.sql.exec(`PRAGMA busy_timeout=3000;
      CREATE INDEX IF NOT EXISTS idx_lessons_cm_created ON lessons(namespace, user_id, agent_id, status, created_at, lesson_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_cm_updated ON lessons(namespace, user_id, agent_id, updated_at);`);
    return this.sql;
  }

  /** SQL parameters for "this user's memories". */
  private get w(): [string, string, string] {
    return [this.scope.namespace, this.scope.userId, this.scope.agentId];
  }

  private toMemory = (l: Lesson): Memory => {
    const last = String(l.extra.lastConfirmedAt ?? l.createdAt);
    return {
      id: l.lessonId,
      text: l.text,
      tags: (l.extra.tags as string[]) ?? [],
      key: (l.extra.key as string) ?? null,
      status: l.status,
      replacedBy: l.replacedBy,
      supersedes: (l.extra.supersedes as string[]) ?? [],
      createdAt: l.createdAt,
      confidence: this.effConf(l.confidence, last),
      confirmations: Number(l.extra.confirmations ?? 0),
      ...(l.score !== undefined ? { score: l.score } : {}),
    };
  };

  private rowMemory(r: any): Memory {
    const x = JSON.parse(r.extra || "{}");
    return {
      id: r.lesson_id,
      text: r.text,
      tags: x.tags ?? [],
      key: x.key ?? null,
      status: r.status,
      replacedBy: r.replaced_by,
      supersedes: x.supersedes ?? [],
      createdAt: r.created_at,
      confidence: this.effConf(r.confidence, String(x.lastConfirmedAt ?? r.created_at)),
      confirmations: Number(x.confirmations ?? 0),
    };
  }

  private effConf(base: number, last: string): number {
    const c = this.cfg.confidence;
    const halfLifeDays = this.opts.halfLifeDays ?? c.halfLifeDays;
    const eff = effectiveConfidence({ base, confirmations: 0, lastConfirmedAt: last }, this.now(), { halfLifeDays, floor: c.floor });
    return Number(eff.toFixed(3));
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  // ----- remember / correct / confirm -----

  /**
   * Remember a fact. Same `key` (or explicit `supersedes`) replaces the old version.
   * A near-identical active fact is CONFIRMED instead of duplicated (confidence rises).
   */
  async remember(
    text: string,
    o: { tags?: string[]; key?: string; supersedes?: string; confidence?: number; embedding?: Float32Array } = {},
  ): Promise<Memory & { confirmed?: boolean }> {
    text = String(text ?? "").trim();
    if (!text) throw new Error("memory text is empty");
    if (text.length > 4000) throw new Error("memory text is too long (max 4000 characters)");
    const tags = [...new Set((o.tags ?? []).map((t) => normScope(t)).filter(Boolean))];
    for (const t of tags) this.policy.addScope(this.userId, t);
    const db = await this.db();
    let supersedes = o.supersedes;
    if (!supersedes && o.key) {
      const row = db
        .prepare(`SELECT lesson_id FROM lessons WHERE namespace=? AND user_id=? AND agent_id=? AND status='active'
          AND json_extract(extra,'$.key')=? LIMIT 1`)
        .get(...this.w, o.key) as any;
      supersedes = row?.lesson_id;
    }
    if (!supersedes) {
      const active = db
        .prepare(`SELECT lesson_id id, text, created_at createdAt, status FROM lessons
          WHERE namespace=? AND user_id=? AND agent_id=? AND status='active'`)
        .all(...this.w) as any[];
      const dup = findDuplicate(text, active, this.cfg.duplicates.threshold);
      if (dup) return { ...(await this.confirm(dup.id)), confirmed: true };
    }
    const at = this.nowIso();
    const l = await this.mem.remember(this.scope, {
      text,
      trigger: [o.key ?? "", ...tags].join(" ").trim(),
      kind: "fact",
      supersedes,
      createdAt: at,
      confidence: o.confidence ?? this.cfg.confidence.initial,
      ...(o.embedding ? { embedding: o.embedding } : {}),
      extra: { tags, ...(o.key ? { key: o.key } : {}), confirmations: 0, lastConfirmedAt: at },
    });
    return this.toMemory(l);
  }

  /** Correct a memory: writes a new version and marks the old one replaced. Tags/key carry over. */
  async update(id: string, text: string): Promise<Memory> {
    const old = await this.mem.current(this.scope, id);
    return this.remember(text, {
      tags: (old.extra.tags as string[]) ?? [],
      key: (old.extra.key as string) ?? undefined,
      supersedes: old.lessonId,
    });
  }

  /** Confirm a memory is still true: confidence rises and the decay clock restarts. */
  async confirm(id: string): Promise<Memory> {
    const l = await this.mem.current(this.scope, id);
    const eff = this.toMemory(l).confidence;
    const u = await this.mem.store.updateLesson(this.scope, l.lessonId, {
      confidence: confirmConfidence(eff, this.cfg.confidence.gain),
      extra: { ...l.extra, confirmations: Number(l.extra.confirmations ?? 0) + 1, lastConfirmedAt: this.nowIso() },
      updatedAt: this.nowIso(),
    });
    return this.toMemory(u);
  }

  // ----- recall -----

  async recall(query: string, k = 5, tags?: string[]): Promise<Memory[]> {
    const got = (await this.mem.recall(this.scope, query, 50)).map(this.toMemory);
    return got.filter((m) => !tags || tags.includes("*") || m.tags.some((t) => tags.includes(t))).slice(0, k);
  }

  /**
   * Recall plus an answerability check (see abstain.ts): cosine(query, top memory) blended with lexical
   * coverage, lexical only when there are no vectors. Below the threshold no memories are returned.
   */
  async recallWithEvidence(query: string, k = 5, tags?: string[]): Promise<RecallEvidence> {
    const got = await this.recall(query, k, tags);
    if (!got.length) return { memories: [], evidence: 0, cosine: null, lexical: 0, abstained: true, candidates: [] };
    const top = got[0]!;
    const lexical = lexicalCoverage(query, top.text);
    const cosine = await this.queryCosine(query, top.id);
    const { evidence, abstained } = answerability(cosine, lexical, this.cfg.recall.abstain);
    return {
      memories: abstained ? [] : got,
      evidence: Number(evidence.toFixed(4)),
      cosine,
      lexical: Number(lexical.toFixed(4)),
      abstained,
      candidates: got,
    };
  }

  /** Cosine between the query and a stored memory's vector; null without an embedder or vector. */
  private async queryCosine(query: string, id: string): Promise<number | null> {
    if (!this.opts.embedder) return null;
    const row = (await this.db())
      .prepare(`SELECT embedding FROM lessons WHERE lesson_id=? AND namespace=? AND user_id=? AND agent_id=?`)
      .get(id, ...this.w) as any;
    if (!row?.embedding) return null;
    const [qe] = await this.opts.embedder([query]);
    const b = row.embedding as Uint8Array;
    const v = new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    return qe ? cosineSim(qe, v) : null;
  }

  async list(includeReplaced = false): Promise<Memory[]> {
    const lessons = await this.mem.listLessons(this.scope, { status: includeReplaced ? ["active", "replaced"] : ["active"] });
    return lessons.map(this.toMemory);
  }

  async history(id: string): Promise<Memory[]> {
    return (await this.mem.history(this.scope, id)).map(this.toMemory);
  }

  // ----- learning -----

  private async facts(includeReplaced: boolean): Promise<Fact[]> {
    const ls = await this.mem.listLessons(this.scope, { status: includeReplaced ? ["active", "replaced"] : ["active"] });
    return ls.map((l) => ({
      id: l.lessonId,
      text: l.text,
      createdAt: l.createdAt,
      status: l.status,
      tags: (l.extra.tags as string[]) ?? [],
      key: (l.extra.key as string) ?? null,
      embedding: l.embedding,
    }));
  }

  /** Active memories that contradict each other. Resolve with update/supersede. */
  async conflicts(): Promise<Conflict[]> {
    return detectConflicts(await this.facts(false), this.cfg.conflicts);
  }

  /** Recurring patterns across all versions (replaced versions count as evidence). */
  async patterns(o: { minSupport?: number; minDays?: number } = {}): Promise<Pattern[]> {
    return detectPatterns(await this.facts(true), { ...this.cfg.patterns, ...o });
  }

  // ----- paging + aggregates (SQL, scoped to this user) -----

  /** Newest first. cursor = opaque "createdAt|id". scope matches any tag. q is a case-insensitive substring. */
  async page(
    o: { limit?: number; cursor?: string | null; q?: string; scope?: string; status?: MemoryStatusFilter } = {},
  ): Promise<MemoryPage> {
    const db = await this.db();
    const limit = Math.min(200, Math.max(1, o.limit ?? this.cfg.ui.pageSize));
    const st = o.status === "all" ? ["active", "replaced"] : [o.status ?? "active"];
    let sql = `SELECT lesson_id, text, status, replaced_by, created_at, confidence, extra FROM lessons
      WHERE namespace=? AND user_id=? AND agent_id=? AND status IN (${st.map(() => "?").join(",")})`;
    const p: string[] = [...this.w, ...st];
    if (o.cursor) {
      const i = o.cursor.lastIndexOf("|");
      const at = o.cursor.slice(0, i);
      sql += ` AND (created_at < ? OR (created_at = ? AND lesson_id < ?))`;
      p.push(at, at, o.cursor.slice(i + 1));
    }
    if (o.scope) {
      sql += ` AND EXISTS (SELECT 1 FROM json_each(extra,'$.tags') WHERE value = ?)`;
      p.push(normScope(o.scope));
    }
    if (o.q?.trim()) {
      sql += ` AND text LIKE ? ESCAPE '\\'`;
      p.push(`%${o.q.trim().replace(/[\\%_]/g, (c) => "\\" + c)}%`);
    }
    sql += ` ORDER BY created_at DESC, lesson_id DESC LIMIT ${limit + 1}`;
    const rows = db.prepare(sql).all(...p) as any[];
    const items = rows.slice(0, limit).map((r) => this.rowMemory(r));
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? `${last.createdAt}|${last.id}` : null };
  }

  /** Aggregates, cached until memories change (and at most a minute, since confidence decays with time). */
  async stats(): Promise<MemoryStats> {
    const key = (await this.signature()) + "|" + Math.floor(this.now().getTime() / 60000);
    if (this.statsCache?.key === key) return this.statsCache.value;
    const value = await this.computeStats();
    this.statsCache = { key, value };
    return value;
  }

  private async computeStats(): Promise<MemoryStats> {
    const db = await this.db();
    const where = `FROM lessons WHERE namespace=? AND user_id=? AND agent_id=?`;
    const byStatus = db.prepare(`SELECT status, COUNT(*) n ${where} GROUP BY status`).all(...this.w) as any[];
    const by = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
    const perScope = db
      .prepare(`SELECT COALESCE(json_extract(extra,'$.tags[0]'),'other') t, COUNT(*) n ${where} AND status='active'
        GROUP BY t ORDER BY n DESC`)
      .all(...this.w) as any[];
    const confs = db
      .prepare(`SELECT confidence c, COALESCE(json_extract(extra,'$.lastConfirmedAt'), created_at) l ${where}
        AND status='active'`)
      .all(...this.w) as any[];
    const avg = confs.length ? confs.reduce((s, r) => s + this.effConf(r.c, r.l), 0) / confs.length : 0;
    return {
      active: by.active ?? 0,
      replaced: by.replaced ?? 0,
      perScope: Object.fromEntries(perScope.map((r) => [r.t, r.n])),
      avgConfidence: Number(avg.toFixed(3)),
    };
  }

  /** Changes whenever this user's memories change (any process). */
  async signature(): Promise<string> {
    const db = await this.db();
    const r = db
      .prepare(`SELECT COUNT(*) n, MAX(updated_at) u, MAX(created_at) c FROM lessons
        WHERE namespace=? AND user_id=? AND agent_id=?`)
      .get(...this.w) as any;
    return `${r.n}|${r.u}|${r.c}`;
  }

  /**
   * Conflicts + titled patterns, cached until memories change.
   * Large sets compute in the background (the stale result is served meanwhile).
   */
  async insights(o: { wait?: boolean } = {}): Promise<Insights & { stale: boolean }> {
    const sig = await this.signature();
    if (this.insightCache?.sig === sig) return { ...this.insightCache.value, stale: false };
    if (!this.insightJob) {
      this.insightJob = (async () => {
        const [conflicts, pats] = [await this.conflicts(), await this.patterns()];
        const value: Insights = {
          conflicts,
          patterns: this.titleFromCache(pats),
          computedAt: this.nowIso(),
          factCount: Number(sig.split("|")[0]),
        };
        this.insightCache = { sig, value };
        return value;
      })().finally(() => {
        this.insightJob = null;
      });
    }
    const stats = await this.stats();
    if (o.wait || stats.active + stats.replaced <= INSIGHTS_SYNC_LIMIT) return { ...(await this.insightJob), stale: false };
    const empty: Insights = { conflicts: [], patterns: [], computedAt: "", factCount: 0 };
    return { ...(this.insightCache?.value ?? empty), stale: true };
  }

  /** Graph for the constellation: raw nodes when small, per-scope clusters when large (expand one scope with `scope`). */
  async graph(o: { scope?: string } = {}): Promise<Graph> {
    const st = await this.stats();
    const ui = this.cfg.ui;
    const ins = await this.insights();
    const edgesFor = (nodes: Memory[]): GraphEdges => {
      const ids = new Set(nodes.map((n) => n.id));
      return {
        habit: ins.patterns.flatMap((p) =>
          p.evidence
            .filter((e) => ids.has(e))
            .map((e, i, a) => (i ? [a[i - 1]!, e] : null))
            .filter(Boolean),
        ) as [string, string][],
        conflict: ins.conflicts.filter((c) => ids.has(c.a) && ids.has(c.b)).map((c) => [c.a, c.b] as [string, string]),
        correction: nodes
          .filter((m) => m.replacedBy && ids.has(m.replacedBy))
          .map((m) => [m.id, m.replacedBy!] as [string, string]),
      };
    };
    const limit = Math.min(200, ui.maxNodes);
    if (!o.scope && st.active <= ui.clusterAbove) {
      const nodes = (await this.page({ status: "all", limit })).items;
      return { mode: "nodes", total: st.active + st.replaced, nodes, edges: edgesFor(nodes) };
    }
    if (o.scope) {
      const scope = normScope(o.scope);
      const nodes = (await this.page({ status: "active", scope: o.scope, limit })).items;
      return { mode: "nodes", scope, total: st.perScope[scope] ?? nodes.length, nodes, edges: edgesFor(nodes) };
    }
    const clusters = Object.entries(st.perScope).map(([scope, count]) => ({ scope, count }));
    return { mode: "clusters", total: st.active, clusters };
  }

  // ----- scopes, agents, import -----

  async scopes(): Promise<string[]> {
    const st = await this.stats();
    const fromMemories = Object.keys(st.perScope).filter((s) => s !== "other");
    return [...new Set([...this.policy.scopes(this.userId), ...fromMemories])];
  }

  addScope(name: string): string {
    const n = normScope(name);
    if (!n) throw new Error("scope name is empty");
    this.policy.addScope(this.userId, n);
    return n;
  }

  addAgent(id: string): string {
    const a = String(id ?? "").trim();
    if (!AGENT_ID.test(a) || a === "owner") throw new Error("agent id: letters, numbers, . _ - (max 64)");
    this.policy.noteAgent(this.userId, a);
    return a;
  }

  /** Import many memories. Formats: text (one per line), json ([{text,tags?,key?}] or ["..."]), csv (text[,tags][,key] with header). */
  async importMemories(data: string, format: ImportFormat, o: { defaultScope?: string } = {}): Promise<ImportResult> {
    const { maxBytes, maxItems } = this.cfg.import;
    if (data.length > maxBytes) throw new Error(`import is larger than ${maxBytes} bytes`);
    const items = parseImport(data, format).slice(0, maxItems + 1);
    if (items.length > maxItems) throw new Error(`import has more than ${maxItems} items`);
    let added = 0;
    let confirmed = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const [i, it] of items.entries()) {
      if (!it.text?.trim()) {
        skipped++;
        continue;
      }
      try {
        const tags = it.tags?.length ? it.tags : o.defaultScope ? [o.defaultScope] : [];
        const m = await this.remember(it.text, { tags, key: it.key || undefined });
        if (m.confirmed) confirmed++;
        else added++;
      } catch (e) {
        errors.push(`item ${i + 1}: ${(e as Error).message}`);
        if (errors.length > 20) break;
      }
    }
    return { added, confirmed, skipped, errors };
  }

  /** The model reads a chat transcript and proposes durable facts. Nothing is stored until the user saves them. */
  async extract(transcript: string): Promise<ExtractedFact[]> {
    if (!this.opts.chat) throw new Error("extraction needs the model (API key not configured)");
    if (transcript.length > 20000) throw new Error("transcript too long (max 20000 characters)");
    const scopes = await this.scopes();
    const r = await this.opts.chat(
      [
        { role: "system", content: extractSystem(scopes) },
        { role: "user", content: transcript },
      ],
      { json: true },
    );
    let j: any;
    try {
      j = JSON.parse(r.content.slice(r.content.indexOf("{"), r.content.lastIndexOf("}") + 1));
    } catch {
      throw new Error("the model did not return facts");
    }
    return (Array.isArray(j?.facts) ? j.facts : [])
      .slice(0, 20)
      .filter((f: any) => typeof f?.text === "string" && f.text.trim())
      .map((f: any) => ({
        text: String(f.text).trim().slice(0, 500),
        scope: f.scope ? normScope(String(f.scope)) || null : null,
      }));
  }

  // ----- agent lessons (agentmemory runs + distiller through the chat model) -----

  private lscope(agentId: string): Scope {
    return { namespace: "clearmind-lessons", userId: this.opts.ownerId, agentId };
  }

  startRun(agentId: string, task: string): Promise<string> {
    this.policy.noteAgent(this.opts.ownerId, agentId);
    return this.lessonsMem.startRun(this.lscope(agentId), task);
  }

  record(agentId: string, runId: string, e: EventInput): Promise<string> {
    return this.lessonsMem.record(this.lscope(agentId), runId, e);
  }

  async endRun(agentId: string, runId: string, outcome: Outcome): Promise<Lesson[]> {
    return [...(await this.lessonsMem.endRun(this.lscope(agentId), runId, outcome))];
  }

  /** Agents this user knows about (added, granted, or with recorded runs). */
  lessonAgents(): string[] {
    return this.policy.agents(this.opts.ownerId);
  }

  lessons(agentId: string): Promise<Lesson[]> {
    return this.lessonsMem.listLessons(this.lscope(agentId), { status: ["active", "candidate"] });
  }

  recallLessons(agentId: string, task: string, k = 3): Promise<Lesson[]> {
    return this.lessonsMem.recall(this.lscope(agentId), task, k);
  }

  // ----- access policy -----

  grant(g: { agentId: string; tags: string[]; purposes: string[]; consentBy: string; ttlMs?: number | null }): Grant {
    return this.policy.grant(this.opts.ownerId, g);
  }

  revoke(grantId: string, by: string): Grant {
    return this.policy.revoke(this.opts.ownerId, grantId, by);
  }

  /** An agent reads memories. Purpose is required; every attempt is logged. */
  async read(req: { agentId: string; purpose?: string | null; tags?: string[]; query: string; k?: number }): Promise<ReadResult> {
    const c = this.policy.check(this.opts.ownerId, req);
    const memories = c.decision === "allowed" ? await this.recall(req.query, req.k ?? 5, c.tags) : [];
    const log = this.policy.record(this.opts.ownerId, req, c, memories.map((m) => m.id));
    return { decision: c.decision, reason: c.reason, memories, log };
  }

  /**
   * Answer a question from memory through the chat model. Agents go through the access policy
   * (purpose + scope required, logged); the owner (agentId "owner") reads everything.
   */
  async ask(
    question: string,
    req: { agentId?: string; purpose?: string | null; tags?: string[]; k?: number } = {},
  ): Promise<AskResult> {
    if (!this.opts.chat) throw new Error("ask needs a chat model (set NEBIUS_API_KEY via --env-file)");
    const agentId = req.agentId ?? "owner";
    let r: ReadResult;
    if (agentId === "owner") {
      const memories = (await this.recallWithEvidence(question, req.k ?? 6)).memories;
      const c = { decision: "allowed" as const, reason: "owner", grant: null, tags: ["*"] };
      const ids = memories.map((m) => m.id);
      r = { ...c, memories, log: this.policy.record(this.opts.ownerId, { agentId, purpose: req.purpose ?? "owner-ask" }, c, ids) };
    } else {
      r = await this.read({ agentId, purpose: req.purpose, tags: req.tags, query: question, k: req.k ?? 6 });
    }
    if (r.decision === "denied") return { ...r, answer: `Access denied: ${r.reason}`, cited: [] };
    if (!r.memories.length) return { ...r, answer: NO_MEMORY, cited: [], abstained: true };
    const ctx = r.memories
      .map((m) => `[${m.id}] (confidence ${m.confidence}, ${m.createdAt.slice(0, 10)}) ${m.text}`)
      .join("\n");
    const res = await this.opts.chat([
      { role: "system", content: this.opts.answerPrompt ?? ASK_SYSTEM },
      { role: "user", content: `MEMORIES:\n${ctx || "(no memories matched)"}\n\nQUESTION: ${question}` },
    ]);
    const { content, ...usage } = res;
    if (isNoMemoryReply(content)) return { ...r, answer: NO_MEMORY, cited: [], abstained: true, usage };
    const ids = [...content.matchAll(/\[([0-9A-Z]{10,})\]/g)].map((m) => m[1]!);
    const cited = [...new Set(ids)].filter((id) => r.memories.some((m) => m.id === id));
    return { ...r, answer: content, cited, usage };
  }

  // ----- pattern titles -----

  private titleFile(): string {
    return join(this.opts.dir, `pattern-titles.${this.userId}.json`);
  }

  /** Titles from the cache (heuristic when missing); starts background titling for the missing ones. Never blocks on the model. */
  private titleFromCache(pats: Pattern[]): TitledPattern[] {
    const cache = readTitles(this.titleFile());
    const missing = pats.filter((p) => !cache[titleKey(p)]);
    if (missing.length && this.opts.chat && !this.titling) {
      this.titling = true;
      this.titledPatterns()
        .then(() => {
          this.insightCache = null;
        })
        .catch(() => {})
        .finally(() => {
          this.titling = false;
        });
    }
    const facts = new Map<string, string>();
    for (const m of this.syncTexts(missing.flatMap((p) => p.evidence).slice(0, 5000))) facts.set(m.id, m.text);
    return pats.map((p) => {
      const t = cache[titleKey(p)];
      if (t) return { ...p, title: t };
      return { ...p, title: heuristicTitle(p.evidence.map((e) => facts.get(e) ?? ""), p.terms) };
    });
  }

  /** Human-readable pattern titles: one model call per pattern (cached per user), heuristic fallback. */
  async titledPatterns(o: { minSupport?: number; minDays?: number } = {}): Promise<TitledPattern[]> {
    const pats = await this.patterns(o);
    const file = this.titleFile();
    const cache = readTitles(file);
    const facts = await this.list(true);
    const text = (id: string) => facts.find((f) => f.id === id)?.text ?? "";
    let calls = 0;
    let dirty = false;
    const out: TitledPattern[] = [];
    for (const p of pats) {
      const key = titleKey(p);
      let title = cache[key];
      if (!title && this.opts.chat && calls++ < MAX_TITLE_CALLS) {
        try {
          const r = await this.opts.chat([
            { role: "system", content: TITLE_SYSTEM },
            { role: "user", content: p.evidence.map(text).join("\n") },
          ]);
          title = cleanTitle(r.content);
          if (title) {
            cache[key] = title;
            dirty = true;
          }
        } catch {
          title = "";
        }
      }
      out.push({ ...p, title: title || heuristicTitle(p.evidence.map(text), p.terms) });
    }
    if (dirty) writeTitles(file, cache);
    return out;
  }

  /** id -> text for this user's memories (unknown or foreign ids are simply absent). */
  async textsFor(ids: string[]): Promise<Record<string, string>> {
    await this.db();
    const rows = this.syncTexts([...new Set(ids)].slice(0, 5000));
    return Object.fromEntries(rows.map((r) => [r.id, r.text]));
  }

  private syncTexts(ids: string[]): { id: string; text: string }[] {
    if (!this.sql || !ids.length) return [];
    return this.sql
      .prepare(`SELECT lesson_id id, text FROM lessons WHERE namespace=? AND user_id=? AND agent_id=?
        AND lesson_id IN (${ids.map(() => "?").join(",")})`)
      .all(...this.w, ...ids) as any[];
  }

  accessLog(agentId?: string): AccessLogEntry[] {
    return this.policy.accessLog(this.opts.ownerId, agentId ? { agentId } : undefined);
  }

  async close(): Promise<void> {
    await this.insightJob?.catch(() => {});
    this.sql?.close();
    this.policy.close();
    await this.mem.close();
    await this.lessonsMem.close();
  }
}
