// Clearmind: a memory layer you can see, correct and trust. Built on agentmemory.
// One instance serves one user; every query is scoped to that user.
import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { AgentMemory, applyUseFeedback, DEFAULT_MEMORY_CONFIG, hardForget, HybridRetriever, learningConfig, learnState, newModel, sgdStep, SqliteStore } from "agentmemory";
import type { ScoreModel } from "agentmemory";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { RecallConfidence } from "agentmemory";
import { buildEngine, retrieval as resolveRetrieval, type Engine } from "./recall/engine.js";
import type { Embedder, EventInput, Lesson, LLM, Outcome, Scope } from "agentmemory";
import { answerability, cosineSim, isNoMemoryReply, lexicalCoverage, NO_MEMORY } from "./abstain.js";
import { DEFAULTS, validUserId } from "./config.js";
import type { Config } from "./config.js";
import { parseImport } from "./importer.js";
import { confirmConfidence, detectConflicts, detectPatterns, effectiveConfidence, findDuplicate } from "./learning.js";
import type { Fact } from "./learning.js";
import { AccessPolicy } from "./policy.js";
import { features as resolveFeatures, type Features } from "./features/config.js";
import { decomposeQuery, interleave } from "./features/decompose.js";
import { adaptiveAbstain } from "./features/adaptiveAbstain.js";
import { detectInjection } from "./features/injection.js";
import { spotlight } from "./features/provenance.js";
import { conflictNote, findConflicts } from "./features/conflicts.js";
import { citationEvidence, selfCheck } from "./features/verify.js";
import { applyTimeAwareRecall } from "./time/index.js";
import { ASK_SYSTEM, extractSystem, TITLE_SYSTEM } from "./prompts.js";
import { hasNebiusKey, nebiusProvider } from "./providers/nebius.js";
import type { ChatFn } from "./providers/provider.js";
import { normScope } from "./scopes.js";
import { SpendLedger } from "./spend.js";
import { EntityStore, type EntityDetail } from "./entities.js";
import { extractEntities } from "./extract-entities.js";
import { aclSql, allows, fullAccess, normVisibleTo, principalsOf, WORKSPACE, type Viewer } from "./visibility.js";
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
  private engine: Engine;
  private ents: EntityStore | null = null;
  private scoreModel: ScoreModel | null = null;

  constructor(private opts: ClearmindOptions) {
    if (!validUserId(opts.ownerId)) throw new Error(`invalid user id "${opts.ownerId}"`);
    mkdirSync(opts.dir, { recursive: true });
    this.cfg = opts.config ?? DEFAULTS;
    this.now = opts.now ?? (() => new Date());
    this.scope = { namespace: "clearmind", userId: opts.ownerId, agentId: "owner" };
    const minSimilarity = opts.minSimilarity ?? this.cfg.recall.minSimilarity;
    const minLexicalSimilarity = this.cfg.recall.minLexicalSimilarity;
    const rv = resolveRetrieval(this.cfg.retrieval);
    if (rv.learning) this.scoreModel = this.loadModel();
    this.engine = buildEngine(opts.dir, rv, { now: this.now, embedder: opts.embedder, model: () => this.scoreModel });
    this.mem = new AgentMemory({
      store: this.engine.store,
      embedder: opts.embedder,
      retriever: this.engine.retriever,
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

  /** The configured chat model (undefined offline). */
  get chatFn(): ChatFn | undefined { return this.opts.chat; }

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
      CREATE INDEX IF NOT EXISTS idx_lessons_cm_updated ON lessons(namespace, user_id, agent_id, updated_at);
      CREATE TABLE IF NOT EXISTS cm_acl (item_kind TEXT NOT NULL, item_id TEXT NOT NULL, principal TEXT NOT NULL, PRIMARY KEY (item_kind, item_id, principal)) WITHOUT ROWID;
      CREATE INDEX IF NOT EXISTS idx_cm_acl_principal ON cm_acl(item_kind, principal, item_id);`);
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
      ...(Array.isArray(l.extra.visibleTo) ? { visibleTo: l.extra.visibleTo as string[] } : {}),
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
      ...(Array.isArray(x.visibleTo) ? { visibleTo: x.visibleTo } : {}),
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
    o: {
      tags?: string[]; key?: string; supersedes?: string; confidence?: number; embedding?: Float32Array;
      /** Extra metadata kept on the memory (e.g. provenance). */
      extra?: Record<string, unknown>;
      /** Principals allowed to see this memory (default: whole workspace). */
      visibleTo?: string[];
      /** false = always store, never fold into a near-identical memory. */
      dedup?: boolean;
      /** Provenance URLs / fetch time passed to entity linking. */
      sources?: string[]; fetchedAt?: string;
    } = {},
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
    if (!supersedes && o.dedup !== false) {
      const active = db
        .prepare(`SELECT lesson_id id, text, created_at createdAt, status FROM lessons
          WHERE namespace=? AND user_id=? AND agent_id=? AND status='active'`)
        .all(...this.w) as any[];
      // only an item with the same visibility counts as a duplicate (never confirm into someone else's private memory)
      const want = normVisibleTo(o.visibleTo).sort().join(","), vis = this.aclOf(db, "memory", active.map((a) => a.id));
      const dup = findDuplicate(text, active.filter((a) => (vis.get(a.id) ?? [WORKSPACE]).sort().join(",") === want), this.cfg.duplicates.threshold);
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
      extra: {
        ...(o.extra ?? {}), tags, ...(o.key ? { key: o.key } : {}), confirmations: 0, lastConfirmedAt: at,
        ...(o.visibleTo ? { visibleTo: normVisibleTo(o.visibleTo) } : {}),
      },
    });
    if (o.visibleTo) this.writeAcl(db, "memory", l.lessonId, normVisibleTo(o.visibleTo));
    if (this.entityCfg.enabled) await this.linkEntities(l.lessonId, text, { sources: o.sources, fetchedAt: o.fetchedAt });
    return this.toMemory(l);
  }

  /** Correct a memory: writes a new version and marks the old one replaced. Tags/key carry over. */
  async update(id: string, text: string, o: { visibleTo?: string[]; viewer?: Viewer } = {}): Promise<Memory> {
    const old = await this.mem.current(this.scope, id);
    if (!(await this.canSee(old.lessonId, o.viewer))) throw new Error("no such memory");
    if (this.learningOn) {
      // a user correction is explicit evidence the old memory was wrong: one Beta failure
      const st = learnState(old); st.f += 1;
      await this.mem.store.updateLesson(this.scope, old.lessonId, { extra: { ...old.extra, learn: st } });
    }
    return this.remember(text, {
      tags: (old.extra.tags as string[]) ?? [],
      key: (old.extra.key as string) ?? undefined,
      supersedes: old.lessonId,
      visibleTo: o.visibleTo ?? (old.extra.visibleTo as string[] | undefined) ?? (await this.visibleToOf(old.lessonId)),
    });
  }

  // ----- visibility (see visibility.ts) -----

  private writeAcl(db: DatabaseSync, kind: string, id: string, to: string[]): void {
    db.prepare(`DELETE FROM cm_acl WHERE item_kind=? AND item_id=?`).run(kind, id);
    const ins = db.prepare(`INSERT OR IGNORE INTO cm_acl (item_kind,item_id,principal) VALUES (?,?,?)`);
    for (const p of to) ins.run(kind, id, p);
  }
  /** id -> principals for items that have explicit acl rows (absent = workspace). */
  private aclOf(db: DatabaseSync, kind: string, ids: string[]): Map<string, string[]> {
    const out = new Map<string, string[]>();
    if (!ids.length) return out;
    const rows = db.prepare(`SELECT item_id, principal FROM cm_acl WHERE item_kind=? AND item_id IN (SELECT value FROM json_each(?))`).all(kind, JSON.stringify(ids)) as any[];
    for (const r of rows) (out.get(r.item_id) ?? out.set(r.item_id, []).get(r.item_id)!).push(r.principal);
    return out;
  }
  /** A memory's visibleTo (["workspace"] when it has no acl). */
  async visibleToOf(id: string, kind: "memory" | "entity" = "memory"): Promise<string[]> {
    return this.aclOf(await this.db(), kind, [id]).get(id) ?? [WORKSPACE];
  }
  /** Change who can see a memory (owner/admin action). */
  async setVisibility(id: string, visibleTo: string[]): Promise<string[]> {
    const l = await this.mem.current(this.scope, id), to = normVisibleTo(visibleTo);
    await this.mem.store.updateLesson(this.scope, l.lessonId, { extra: { ...l.extra, visibleTo: to } });
    this.writeAcl(await this.db(), "memory", l.lessonId, to);
    this.statsCache = null;
    return to;
  }
  /** Give an entity its own acl (overrides "visible through its memories"). Pass null to clear. */
  async setEntityVisibility(entityId: string, visibleTo: string[] | null): Promise<void> {
    const db = await this.db();
    if (visibleTo === null) db.prepare(`DELETE FROM cm_acl WHERE item_kind='entity' AND item_id=?`).run(entityId);
    else this.writeAcl(db, "entity", entityId, normVisibleTo(visibleTo));
  }
  /** SQL fragment + params: memory column `col` visible to the viewer ("1" when unrestricted). */
  private memVis(v: Viewer | undefined, col = "lesson_id"): [string, string[]] {
    return fullAccess(v) ? ["1", []] : [aclSql("memory", col), principalsOf(v!)];
  }
  /** Can this viewer see the memory? */
  async canSee(id: string, viewer?: Viewer): Promise<boolean> {
    if (fullAccess(viewer)) return true;
    return (await this.filterVisible([id], viewer)).length > 0;
  }
  /** The subset of ids visible to the viewer, in the given order (one indexed query). */
  private filterSync(ids: string[], viewer?: Viewer): string[] {
    if (fullAccess(viewer) || !ids.length || !this.sql) return ids;
    const [w, p] = this.memVis(viewer, "j.value");
    const ok = new Set((this.sql.prepare(`SELECT j.value id FROM json_each(?) j WHERE ${w}`).all(JSON.stringify(ids), ...p) as any[]).map((r) => r.id as string));
    return ids.filter((id) => ok.has(id));
  }
  async filterVisible(ids: string[], viewer?: Viewer): Promise<string[]> {
    await this.db();
    return this.filterSync(ids, viewer);
  }
  private async filterMems<T extends { id: string }>(xs: T[], viewer?: Viewer): Promise<T[]> {
    if (fullAccess(viewer)) return xs;
    const ok = new Set(await this.filterVisible(xs.map((x) => x.id), viewer));
    return xs.filter((x) => ok.has(x.id));
  }
  /** All memory ids (any status) this viewer can see, or null when unrestricted. For callers that read memory.db directly. */
  async visibleMemoryIds(viewer?: Viewer): Promise<Set<string> | null> {
    if (fullAccess(viewer)) return null;
    const [w, p] = this.memVis(viewer);
    return new Set(((await this.db()).prepare(`SELECT lesson_id FROM lessons WHERE namespace=? AND user_id=? AND agent_id=? AND ${w}`).all(...this.w, ...p) as any[]).map((r) => r.lesson_id));
  }
  /**
   * Entity ids this viewer can see, or null when unrestricted. Visible = own acl allows, or (no own acl) at least one
   * visible memory links to it. Unlinked entities without an acl are hidden from restricted viewers.
   */
  async visibleEntityIds(viewer?: Viewer): Promise<Set<string> | null> {
    if (fullAccess(viewer)) return null;
    const db = await this.entDb(), [w, p] = this.memVis(viewer, "m.memory_id"), pr = principalsOf(viewer!);
    const rows = db.prepare(`SELECT e.id FROM ent.entities e WHERE e.user_id=? AND (
        EXISTS (SELECT 1 FROM cm_acl a WHERE a.item_kind='entity' AND a.item_id=e.id AND a.principal IN (?,?))
        OR (NOT EXISTS (SELECT 1 FROM cm_acl a WHERE a.item_kind='entity' AND a.item_id=e.id)
          AND EXISTS (SELECT 1 FROM ent.memory_entities m JOIN lessons l ON l.lesson_id=m.memory_id AND l.namespace=? AND l.user_id=? AND l.agent_id=?
            WHERE m.entity_id=e.id AND ${w})))`).all(this.userId, ...pr, ...this.w, ...p) as any[];
    return new Set(rows.map((r) => r.id as string));
  }
  private entAttached = false;
  private async entDb(): Promise<DatabaseSync> {
    const db = await this.db();
    if (!this.entAttached) { this.entities; db.exec(`ATTACH DATABASE '${join(this.opts.dir, "entities.db").replaceAll("'", "''")}' AS ent`); this.entAttached = true; }
    return db;
  }
  /** Entity visible to the viewer? */
  async canSeeEntity(id: string, viewer?: Viewer): Promise<boolean> {
    const s = await this.visibleEntityIds(viewer);
    return !s || s.has(id);
  }
  /** Entity list for a viewer (same options as EntityStore.list); total/counts are for what the viewer can see. */
  async entityList(o: { type?: string; q?: string; limit?: number; offset?: number } = {}, viewer?: Viewer) {
    const es = this.entities, s = await this.visibleEntityIds(viewer);
    if (!s) return { entities: es.list(o), total: es.total(), counts: es.counts() };
    const ids = [...s], all = es.list({ ...o, limit: 10_000, offset: 0, only: ids });
    const counts: Record<string, number> = {};
    for (const e of es.list({ limit: 10_000, only: ids })) counts[e.type ?? ""] = (counts[e.type ?? ""] ?? 0) + 1;
    const off = o.offset ?? 0;
    return { entities: all.slice(off, off + Math.min(o.limit ?? 100, 10_000)), total: s.size, counts };
  }
  /** Entity detail with memories, fields and relations limited to what the viewer can see; null when hidden. */
  async entityDetail(id: string, viewer?: Viewer): Promise<EntityDetail | null> {
    const d = this.entities.detail(id);
    if (!d || fullAccess(viewer)) return d;
    const s = await this.visibleEntityIds(viewer);
    if (!s!.has(id)) return null;
    const mem = new Set(await this.filterVisible([...new Set([...d.memoryIds, ...d.relations.map((r) => r.memoryId!).filter(Boolean),
      ...Object.values(d.fields).flatMap((f) => f.memoryIds), ...d.history.flatMap((f) => f.memoryIds)])], viewer));
    const fieldOk = (f: { memoryIds: string[] }) => !f.memoryIds.length || f.memoryIds.some((m) => mem.has(m));
    return {
      ...d,
      memoryIds: d.memoryIds.filter((m) => mem.has(m)),
      memoryCount: d.memoryIds.filter((m) => mem.has(m)).length,
      fields: Object.fromEntries(Object.entries(d.fields).filter(([, f]) => fieldOk(f)).map(([k, f]) => [k, { ...f, memoryIds: f.memoryIds.filter((m) => mem.has(m)) }])),
      history: d.history.filter(fieldOk),
      relations: d.relations.filter((r) => s!.has(r.from) && s!.has(r.to) && (!r.memoryId || mem.has(r.memoryId))),
    };
  }
  /** Memory-entity links where both ends are visible. */
  async entityLinks(viewer?: Viewer) {
    const ls = this.entities.links();
    if (fullAccess(viewer)) return ls;
    const s = (await this.visibleEntityIds(viewer))!, mem = new Set(await this.filterVisible([...new Set(ls.map((l) => l.memoryId))], viewer));
    return ls.filter((l) => s.has(l.entityId) && mem.has(l.memoryId));
  }
  /** Relations where both entities (and the source memory, when recorded) are visible. */
  async entityRelations(viewer?: Viewer, entityId?: string) {
    const rs = this.entities.relations(entityId);
    if (fullAccess(viewer)) return rs;
    const s = (await this.visibleEntityIds(viewer))!, mem = new Set(await this.filterVisible([...new Set(rs.map((r) => r.memoryId!).filter(Boolean))], viewer));
    return rs.filter((r) => s.has(r.from) && s.has(r.to) && (!r.memoryId || mem.has(r.memoryId)));
  }

  /** Confirm a memory is still true: confidence rises and the decay clock restarts. */
  async confirm(id: string): Promise<Memory> {
    const l = await this.mem.current(this.scope, id);
    const eff = this.toMemory(l).confidence;
    const learn = this.learningOn ? (() => { const st = learnState(l); st.acc = [...st.acc, this.nowIso()].slice(-learningConfig(this.learnOpts).maxAccesses); return { learn: st }; })() : {};
    const u = await this.mem.store.updateLesson(this.scope, l.lessonId, {
      confidence: confirmConfidence(eff, this.cfg.confidence.gain),
      extra: { ...l.extra, ...learn, confirmations: Number(l.extra.confirmations ?? 0) + 1, lastConfirmedAt: this.nowIso() },
      updatedAt: this.nowIso(),
    });
    return this.toMemory(u);
  }

  // ----- recall -----

  async recall(query: string, k = 5, tags?: string[], viewer?: Viewer): Promise<Memory[]> {
    // restricted viewers: hidden candidates are dropped right after retrieval, before re-ranking, abstention and any prompt
    let got = (await this.mem.recall(this.scope, query, fullAccess(viewer) ? 50 : 200)).map(this.toMemory);
    got = await this.filterMems(got, viewer);
    if (this.entityCfg.enabled && this.entityCfg.recallBoost > 0) got = await this.entityBoost(query, got, viewer);
    return got.filter((m) => !tags || tags.includes("*") || m.tags.some((t) => tags.includes(t))).slice(0, k);
  }

  /**
   * Recall plus an answerability check (see abstain.ts): cosine(query, top memory) blended with lexical
   * coverage, lexical only when there are no vectors. Below the threshold no memories are returned.
   */
  async recallWithEvidence(query: string, k = 5, tags?: string[], viewer?: Viewer): Promise<RecallEvidence> {
    const f = this.features;
    const got = await this.recallFeatured(query, k, tags, f, viewer);
    if (!got.length) return { memories: [], evidence: 0, cosine: null, lexical: 0, abstained: true, candidates: [] };
    const top = got[0]!;
    const lexical = lexicalCoverage(query, top.text);
    const cosine = await this.queryCosine(query, top.id);
    let { evidence, abstained } = answerability(cosine, lexical, this.cfg.recall.abstain);
    if (f.adaptiveAbstain.enabled && this.cfg.recall.abstain.enabled) {
      const a = this.cfg.recall.abstain;
      abstained = adaptiveAbstain(query, got, evidence, cosine === null ? a.minEvidenceLexical : a.minEvidence, f.adaptiveAbstain).abstained;
    }
    return {
      memories: abstained ? [] : got,
      evidence: Number(evidence.toFixed(4)),
      cosine,
      lexical: Number(lexical.toFixed(4)),
      abstained,
      candidates: got,
    };
  }

  /** Resolved opt-in features (config.features; all off by default). */
  // ----- learning from use (config.retrieval.learning) -----
  private get learningOn(): boolean { return resolveRetrieval(this.cfg.retrieval).learning; }
  private get learnOpts() { return resolveRetrieval(this.cfg.retrieval).learningOptions; }
  private modelFile(): string { return join(this.opts.dir, "recall-model.json"); }
  private loadModel(): ScoreModel {
    const w = DEFAULT_MEMORY_CONFIG.weights; // safe prior = the hand-set weights
    const fresh = newModel([w.similarity, w.helpfulness, w.recency, 0.1]);
    try { if (existsSync(this.modelFile())) return { ...fresh, ...JSON.parse(readFileSync(this.modelFile(), "utf8")) }; } catch { /* corrupt model: start from the prior */ }
    return fresh;
  }
  /** Current learned score model (null when learning is off). */
  get recallModel(): ScoreModel | null { return this.scoreModel; }

  /**
   * Real-use feedback: of the memories shown for one answer, `usedIds` were used (cited). Updates each
   * memory's Beta counts, ACT-R access history and Hebbian links, and takes one SGD step per shown memory
   * on the score weights. No-op unless config.retrieval.learning. Call only with real usage signals.
   */
  async feedback(shownIds: string[], usedIds: string[]): Promise<void> {
    if (!this.learningOn || !shownIds.length) return;
    const lc = learningConfig(this.learnOpts);
    const shown = (await Promise.all(shownIds.map((id) => this.mem.current(this.scope, id).catch(() => null)))).filter((l): l is Lesson => !!l);
    const next = applyUseFeedback(shown, usedIds, this.nowIso(), lc);
    for (const l of shown) await this.mem.store.updateLesson(this.scope, l.lessonId, { extra: { ...l.extra, learn: next.get(l.lessonId) } });
    const feats = this.engine.enhanced?.lastFeatures;
    if (this.scoreModel && feats) {
      const used = new Set(usedIds);
      for (const l of shown) { const x = feats.get(l.lessonId); if (x) this.scoreModel = sgdStep(this.scoreModel, x, used.has(l.lessonId) ? 1 : 0, lc); }
      writeFileSync(this.modelFile(), JSON.stringify(this.scoreModel));
    }
  }

  /** Confidence of the last recall when config.retrieval enables EnhancedRetriever; otherwise null. */
  get lastRecallConfidence(): RecallConfidence | null { return this.engine.enhanced?.lastConfidence ?? null; }

  /** Data directory of this store. */
  get dataDir(): string {
    return this.opts.dir;
  }

  /** Retire a memory without a successor (status replaced, replacedBy null); history keeps it. */
  async retire(id: string): Promise<boolean> {
    await this.mem.init();
    const l = await this.mem.store.getLesson(this.scope, id);
    if (!l || l.status !== "active") return false;
    await this.mem.store.updateLesson(this.scope, id, { status: "replaced", replacedBy: null, updatedAt: this.nowIso() } as any);
    this.statsCache = null;
    if (this.entityCfg.enabled) this.entities.unlinkMemory(id);
    return true;
  }

  /** Hard-delete a memory (right to forget); needs config.retrieval.hardForget. Audited when audit is on. */
  async forget(id: string): Promise<boolean> {
    if (!resolveRetrieval(this.cfg.retrieval).hardForget) throw new Error("forget is disabled; set retrieval.hardForget");
    await this.mem.init();
    this.statsCache = null;
    const ok = await hardForget(this.mem.store, this.scope, id, { audit: this.engine.audit ?? undefined });
    if (ok) (await this.db()).prepare(`DELETE FROM cm_acl WHERE item_kind='memory' AND item_id=?`).run(id);
    if (ok && this.entityCfg.enabled) this.entities.unlinkMemory(id);
    return ok;
  }

  // ----- entities: universal (name, aliases, free-string type, open fields with provenance, free-predicate relations) -----

  /** config.entities: deterministic linking on by default (no model call); the model pass and the recall boost are knobs. */
  get entityCfg(): { enabled: boolean; llm: boolean; recallBoost: number; minConfidence: number; semanticMin: number } {
    return { enabled: true, llm: false, recallBoost: 0.3, minConfidence: 0.5, semanticMin: 0.55, ...((this.cfg as any).entities ?? {}) };
  }
  get entities(): EntityStore {
    return (this.ents ??= new EntityStore(join(this.opts.dir, "entities.db"), this.opts.ownerId, this.now));
  }
  /** Link a memory to the entities it names. Cost is O(words in the text) indexed lookups, independent of store size. */
  async linkEntities(memoryId: string, text: string, o: { sources?: string[]; fetchedAt?: string } = {}): Promise<string[]> {
    const es = this.entities, c = this.entityCfg;
    const ex = extractEntities(text, (n) => es.resolveId(n));
    const prov = { memoryIds: [memoryId], sources: o.sources ?? [], fetchedAt: o.fetchedAt ?? null };
    const ids = new Map<string, string>();
    const idFor = (name: string, type: string | null = null) => {
      let id = es.resolveId(name);
      if (!id && !name.includes(" ")) { const f = es.byFirstWord(name); if (f.length === 1) id = f[0]!; } // a lone first word -> the one full name
      return id && !type ? id : es.upsert(name, type).id;
    };
    es.tx(() => {
      for (const f of ex.entities) if (f.known || f.confidence >= c.minConfidence) { const id = idFor(f.name); es.link(memoryId, id, "mention", f.confidence); ids.set(f.name, id); }
      for (const r of ex.relations) { const a = ids.get(r.from), b = ids.get(r.to); if (a && b) es.relate(a, r.predicate, b, { memoryId, sources: prov.sources, confidence: 0.6 }); }
    });
    if (c.llm && this.opts.chat) {
      // optional model pass: proposes any types, fields and relations as data, each kept with this memory's provenance
      try {
        const r = await this.opts.chat([{ role: "system", content: 'List the named things in the text. Reply JSON {"entities":[{"name":"","type":"","fields":{}}],"relations":[{"from":"","predicate":"","to":""}]}. Names must appear verbatim; type, field names and predicates are short free strings; only facts stated in the text.' }, { role: "user", content: text.slice(0, 3000) }], { json: true, maxTokens: 500 });
        const j = JSON.parse(r.content);
        for (const e of (j.entities ?? []) as { name?: string; type?: string; fields?: Record<string, unknown> }[]) {
          if (!e?.name || !text.includes(e.name)) continue;
          const id = idFor(e.name, typeof e.type === "string" && e.type.trim() ? e.type.trim().toLowerCase() : null); es.link(memoryId, id, "mention", 0.75); ids.set(e.name, id);
          for (const [k, v] of Object.entries(e.fields ?? {})) if (k.trim() && v !== null && v !== "") es.setField(id, k.trim(), v, prov);
        }
        for (const x of (j.relations ?? []) as { from?: string; predicate?: string; to?: string }[]) {
          const a = x.from && ids.get(x.from), b = x.to && ids.get(x.to);
          if (a && b && x.predicate) es.relate(a, String(x.predicate), b, { memoryId, sources: prov.sources, confidence: 0.75 });
        }
      } catch { /* the deterministic result stands */ }
    }
    return [...new Set(ids.values())];
  }
  /** Embed many texts in batched provider calls (bulk ingest); null without an embedder. */
  async embedMany(texts: string[]): Promise<Float32Array[] | null> {
    if (!this.opts.embedder || !texts.length) return null;
    return (await this.opts.embedder(texts)).map((v) => Float32Array.from(v as ArrayLike<number>));
  }
  /** Embed entity profile texts that changed since their last embedding (needs an embedder). */
  async embedEntities(): Promise<number> {
    if (!this.opts.embedder) return 0;
    const todo = this.entities.embeddings().filter((x) => !x.v).map((x) => x.id);
    for (let i = 0; i < todo.length; i += 64) {
      const ids = todo.slice(i, i + 64), vs = await this.opts.embedder(ids.map((id) => this.entities.profileText(id)));
      ids.forEach((id, k) => vs[k] && this.entities.setEmbedding(id, Float32Array.from(vs[k] as ArrayLike<number>)));
    }
    return todo.length;
  }
  /** Entities matching a query: names/aliases it mentions, name/alias text, field/type text, then meaning over profiles. */
  async entitySearch(query: string, k = 5, viewer?: Viewer): Promise<{ entity: EntityDetail; score: number; via: "name" | "text" | "semantic" }[]> {
    const es = this.entities;
    if (!es.total()) return [];
    const vis = await this.visibleEntityIds(viewer);
    const out = new Map<string, { id: string; score: number; via: "name" | "text" | "semantic" }>();
    for (const f of extractEntities(query, (n) => es.resolveId(n)).entities) { const id = es.resolveId(f.name); if (id) out.set(id, { id, score: 1, via: "name" }); }
    for (const e of es.list({ q: query, limit: 20 })) if (!out.has(e.id)) out.set(e.id, { id: e.id, score: 0.95, via: "name" });
    for (const id of es.searchText(query, 20)) if (!out.has(id)) out.set(id, { id, score: 0.8, via: "text" });
    if (this.opts.embedder) {
      await this.embedEntities();
      const [q] = await this.opts.embedder([query]);
      if (q) for (const x of es.embeddings()) if (x.v && !out.has(x.id)) { const s = cosineSim(q, x.v); if (s >= this.entityCfg.semanticMin) out.set(x.id, { id: x.id, score: s, via: "semantic" }); }
    }
    const ranked = [...out.values()].filter((x) => !vis || vis.has(x.id)).sort((a, b) => b.score - a.score).slice(0, k);
    const res = [];
    for (const x of ranked) { const d = await this.entityDetail(x.id, viewer); if (d) res.push({ entity: d, score: Number(x.score.toFixed(4)), via: x.via }); }
    return res;
  }
  /** Recall re-rank: memories linked to an entity the query names (or means) move up; missing linked ones join the pool. */
  private async entityBoost(query: string, got: Memory[], viewer?: Viewer): Promise<Memory[]> {
    const hits = await this.entitySearch(query, 3, viewer).catch(() => []);
    if (!hits.length) return got;
    const linked = new Map<string, number>();
    for (const h of hits) for (const id of h.entity.memoryIds) linked.set(id, Math.max(linked.get(id) ?? 0, h.score));
    const have = new Set(got.map((m) => m.id));
    for (const id of (await this.filterVisible([...linked.keys()].filter((id) => !have.has(id)), viewer)).slice(0, 10)) {
      try { const l = await this.mem.current(this.scope, id); if (l.status === "active") got.push(this.toMemory(l)); } catch { /* forgotten */ }
    }
    const b = this.entityCfg.recallBoost, n = Math.max(1, got.length);
    return got.map((m, i) => ({ m, s: 1 - i / n + b * (linked.get(m.id) ?? 0) })).sort((x, y) => y.s - x.s).map((x) => x.m);
  }
  /** Forget an entity. Without cascade its memories stay and are reported; with cascade they are forgotten too. */
  async forgetEntity(id: string, o: { cascade?: boolean } = {}): Promise<{ entity: string; memoryIds: string[]; forgotten: string[] }> {
    const d = this.entities.detail(id); if (!d) throw new Error("no such entity");
    const forgotten: string[] = [];
    if (o.cascade) for (const m of d.memoryIds) if (await this.forget(m).catch(() => false)) forgotten.push(m);
    this.entities.remove(id);
    return { entity: d.name, memoryIds: d.memoryIds, forgotten };
  }
  /** Link every active memory (idempotent). Multi-word names go first so a lone first word can resolve to them. */
  async backfillEntities(): Promise<{ memories: number; entities: number; links: number; relations: number; ms: number }> {
    const t0 = Date.now(), ms = await this.list(false);
    for (const m of ms) for (const f of extractEntities(m.text).entities) if (f.name.includes(" ") && f.confidence >= this.entityCfg.minConfidence) this.entities.upsert(f.name);
    for (const m of ms) await this.linkEntities(m.id, m.text);
    return { memories: ms.length, entities: this.entities.total(), links: this.entities.links().length, relations: this.entities.relations().length, ms: Date.now() - t0 };
  }

  get features(): Features { return resolveFeatures((this.cfg as any).features); }

  /** recall() plus the opt-in time-aware (6), decomposition (7) and injection-drop (17) stages. */
  private async recallFeatured(query: string, k: number, tags: string[] | undefined, f: Features, viewer?: Viewer): Promise<Memory[]> {
    const pool = f.time.mode !== "off" ? Math.max(k, f.time.pool) : k;
    const parts = f.decompose.enabled ? decomposeQuery(query, f.decompose.maxParts) : [query];
    let got = parts.length > 1
      ? interleave(await Promise.all([query, ...parts].map((q) => this.recall(q, pool, tags, viewer))), pool)
      : await this.recall(query, pool, tags, viewer);
    if (f.injection.mode === "drop") got = got.filter((m) => !detectInjection(m.text).length);
    if (f.time.mode !== "off") got = applyTimeAwareRecall(got, query, f.time, { referenceDate: this.opts.now?.() ?? new Date(), k: pool });
    return got.slice(0, k);
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

  async list(includeReplaced = false, viewer?: Viewer): Promise<Memory[]> {
    if (!fullAccess(viewer)) {
      // SQL-filtered (indexed acl) for restricted viewers
      const st = includeReplaced ? ["active", "replaced"] : ["active"], [w, p] = this.memVis(viewer);
      const rows = (await this.db()).prepare(`SELECT lesson_id, text, status, replaced_by, created_at, confidence, extra FROM lessons
        WHERE namespace=? AND user_id=? AND agent_id=? AND status IN (${st.map(() => "?").join(",")}) AND ${w} ORDER BY created_at, lesson_id`).all(...this.w, ...st, ...p) as any[];
      return rows.map((r) => this.rowMemory(r));
    }
    const lessons = await this.mem.listLessons(this.scope, { status: includeReplaced ? ["active", "replaced"] : ["active"] });
    return lessons.map(this.toMemory);
  }

  async history(id: string, viewer?: Viewer): Promise<Memory[]> {
    const h = (await this.mem.history(this.scope, id)).map(this.toMemory);
    if (fullAccess(viewer)) return h;
    if (!(await this.canSee(id, viewer))) throw new Error("no such memory");
    return this.filterMems(h, viewer);
  }

  // ----- learning -----

  private async facts(includeReplaced: boolean, viewer?: Viewer): Promise<Fact[]> {
    let ls = await this.mem.listLessons(this.scope, { status: includeReplaced ? ["active", "replaced"] : ["active"] });
    if (!fullAccess(viewer)) { const ok = new Set(await this.filterVisible(ls.map((l) => l.lessonId), viewer)); ls = ls.filter((l) => ok.has(l.lessonId)); }
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
  async conflicts(viewer?: Viewer): Promise<Conflict[]> {
    return detectConflicts(await this.facts(false, viewer), this.cfg.conflicts);
  }

  /** Recurring patterns across all versions (replaced versions count as evidence). */
  async patterns(o: { minSupport?: number; minDays?: number; viewer?: Viewer } = {}): Promise<Pattern[]> {
    const { viewer, ...po } = o;
    return detectPatterns(await this.facts(true, viewer), { ...this.cfg.patterns, ...po });
  }

  // ----- paging + aggregates (SQL, scoped to this user) -----

  /** Newest first. cursor = opaque "createdAt|id". scope matches any tag. q is a case-insensitive substring. */
  async page(
    o: { limit?: number; cursor?: string | null; q?: string; scope?: string; status?: MemoryStatusFilter; viewer?: Viewer } = {},
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
    if (!fullAccess(o.viewer)) {
      const [w, vp] = this.memVis(o.viewer);
      sql += ` AND ${w}`;
      p.push(...vp);
    }
    sql += ` ORDER BY created_at DESC, lesson_id DESC LIMIT ${limit + 1}`;
    const rows = db.prepare(sql).all(...p) as any[];
    const items = rows.slice(0, limit).map((r) => this.rowMemory(r));
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? `${last.createdAt}|${last.id}` : null };
  }

  /** Aggregates, cached until memories change (and at most a minute, since confidence decays with time). */
  async stats(viewer?: Viewer): Promise<MemoryStats> {
    if (!fullAccess(viewer)) return this.computeStats(viewer);
    const key = (await this.signature()) + "|" + Math.floor(this.now().getTime() / 60000);
    if (this.statsCache?.key === key) return this.statsCache.value;
    const value = await this.computeStats();
    this.statsCache = { key, value };
    return value;
  }

  private async computeStats(viewer?: Viewer): Promise<MemoryStats> {
    const db = await this.db();
    const [vw, vp] = this.memVis(viewer);
    const where = `FROM lessons WHERE namespace=? AND user_id=? AND agent_id=? AND ${vw}`;
    const W = [...this.w, ...vp];
    const byStatus = db.prepare(`SELECT status, COUNT(*) n ${where} GROUP BY status`).all(...W) as any[];
    const by = Object.fromEntries(byStatus.map((r) => [r.status, r.n]));
    const perScope = db
      .prepare(`SELECT COALESCE(json_extract(extra,'$.tags[0]'),'other') t, COUNT(*) n ${where} AND status='active'
        GROUP BY t ORDER BY n DESC`)
      .all(...W) as any[];
    const confs = db
      .prepare(`SELECT confidence c, COALESCE(json_extract(extra,'$.lastConfirmedAt'), created_at) l ${where}
        AND status='active'`)
      .all(...W) as any[];
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
  async insights(o: { wait?: boolean; viewer?: Viewer } = {}): Promise<Insights & { stale: boolean }> {
    const full = await this.insightsAll(o);
    if (fullAccess(o.viewer)) return full;
    return this.insightsFor(full, o.viewer!);
  }

  /** Restrict insights to what the viewer can see: conflicts need both sides visible; pattern evidence is cut to visible ids and a pattern with no visible evidence is dropped. */
  private async insightsFor(full: Insights & { stale: boolean }, viewer: Viewer): Promise<Insights & { stale: boolean }> {
    const ids = [...new Set([...full.conflicts.flatMap((c) => [c.a, c.b]), ...full.patterns.flatMap((p) => p.evidence)])];
    const ok = new Set(await this.filterVisible(ids, viewer));
    const patterns = full.patterns.map((p) => ({ ...p, evidence: p.evidence.filter((e) => ok.has(e)) })).filter((p) => p.evidence.length);
    const st = await this.stats(viewer);
    return { ...full, conflicts: full.conflicts.filter((c) => ok.has(c.a) && ok.has(c.b)), patterns, factCount: st.active + st.replaced };
  }

  private async insightsAll(o: { wait?: boolean } = {}): Promise<Insights & { stale: boolean }> {
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
  async graph(o: { scope?: string; viewer?: Viewer } = {}): Promise<Graph> {
    const v = o.viewer;
    const st = await this.stats(v);
    const ui = this.cfg.ui;
    const ins = await this.insights({ viewer: v });
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
      const nodes = (await this.page({ status: "all", limit, viewer: v })).items;
      return { mode: "nodes", total: st.active + st.replaced, nodes, edges: edgesFor(nodes) };
    }
    if (o.scope) {
      const scope = normScope(o.scope);
      const nodes = (await this.page({ status: "active", scope: o.scope, limit, viewer: v })).items;
      return { mode: "nodes", scope, total: st.perScope[scope] ?? nodes.length, nodes, edges: edgesFor(nodes) };
    }
    const clusters = Object.entries(st.perScope).map(([scope, count]) => ({ scope, count }));
    return { mode: "clusters", total: st.active, clusters };
  }

  // ----- scopes, agents, import -----

  async scopes(viewer?: Viewer): Promise<string[]> {
    const st = await this.stats(viewer);
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
  async importMemories(data: string, format: ImportFormat, o: { defaultScope?: string; visibleTo?: string[] } = {}): Promise<ImportResult> {
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
        const m = await this.remember(it.text, { tags, key: it.key || undefined, ...(o.visibleTo ? { visibleTo: o.visibleTo } : {}) });
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
  async read(req: { agentId: string; purpose?: string | null; tags?: string[]; query: string; k?: number; viewer?: Viewer }): Promise<ReadResult> {
    const { viewer, ...pr } = req;
    const c = this.policy.check(this.opts.ownerId, pr);
    const memories = c.decision === "allowed" ? await this.recall(req.query, req.k ?? 5, c.tags, viewer) : [];
    const log = this.policy.record(this.opts.ownerId, pr, c, memories.map((m) => m.id));
    return { decision: c.decision, reason: c.reason, memories, log };
  }

  /**
   * Answer a question from memory through the chat model. Agents go through the access policy
   * (purpose + scope required, logged); the owner (agentId "owner") reads everything.
   */
  async ask(
    question: string,
    req: { agentId?: string; purpose?: string | null; tags?: string[]; k?: number; recalled?: RecallEvidence; viewer?: Viewer } = {},
  ): Promise<AskResult> {
    if (!this.opts.chat) throw new Error("ask needs a chat model (set NEBIUS_API_KEY via --env-file)");
    const agentId = req.agentId ?? "owner";
    let r: ReadResult;
    if (agentId === "owner") {
      // reuse a recall the caller already ran for this question (no second recall)
      // a caller-supplied recall is re-checked against the viewer, so nothing hidden can reach the prompt
      const memories = await this.filterMems((req.recalled ?? (await this.recallWithEvidence(question, req.k ?? 6, undefined, req.viewer))).memories, req.viewer);
      const c = { decision: "allowed" as const, reason: "owner", grant: null, tags: ["*"] };
      const ids = memories.map((m) => m.id);
      r = { ...c, memories, log: this.policy.record(this.opts.ownerId, { agentId, purpose: req.purpose ?? "owner-ask" }, c, ids) };
    } else {
      r = await this.read({ agentId, purpose: req.purpose, tags: req.tags, query: question, k: req.k ?? 6, viewer: req.viewer });
    }
    if (r.decision === "denied") return { ...r, answer: `Access denied: ${r.reason}`, cited: [] };
    if (!r.memories.length) return { ...r, answer: NO_MEMORY, cited: [], abstained: true };
    const f = this.features;
    if (f.injection.mode === "drop") r = { ...r, memories: r.memories.filter((m) => !detectInjection(m.text).length) };
    if (!r.memories.length) return { ...r, answer: NO_MEMORY, cited: [], abstained: true };
    const flags = new Map(f.injection.mode === "flag" ? r.memories.map((m) => [m.id, detectInjection(m.text)] as const) : []);
    const conflicts = f.conflicts.enabled ? findConflicts(r.memories) : [];
    let system = this.opts.answerPrompt ?? ASK_SYSTEM, ctx: string;
    if (f.provenance.enabled || f.injection.mode === "flag") {
      const sp = spotlight(r.memories, f, flags);
      ctx = sp.context; system = `${system}\n\n${sp.preamble}`;
    } else {
      ctx = r.memories
        .map((m) => `[${m.id}] (confidence ${m.confidence}, ${m.createdAt.slice(0, 10)}) ${m.text}`)
        .join("\n");
    }
    const res = await this.opts.chat([
      { role: "system", content: system },
      { role: "user", content: `${conflictNote(conflicts)}MEMORIES:\n${ctx || "(no memories matched)"}\n\nQUESTION: ${question}` },
    ]);
    const { content, ...usage } = res;
    if (isNoMemoryReply(content)) return { ...r, answer: NO_MEMORY, cited: [], abstained: true, usage };
    const ids = [...content.matchAll(/\[([0-9A-Z]{10,})\]/g)].map((m) => m[1]!);
    const cited = [...new Set(ids)].filter((id) => r.memories.some((m) => m.id === id));
    const extra: Partial<AskResult> = {};
    if (conflicts.length) extra.conflicts = conflicts;
    if (f.citations.evidence || f.citations.required) extra.evidence = citationEvidence(content, cited, r.memories);
    if (f.citations.required && !cited.length) return { ...r, ...extra, answer: NO_MEMORY, cited: [], abstained: true, usage };
    if (f.selfCheck.enabled) {
      const v = await selfCheck(this.opts.chat, question, content, r.memories);
      extra.verified = v.supported;
      if (!v.supported && f.selfCheck.onUnsupported === "abstain") return { ...r, ...extra, answer: NO_MEMORY, cited: [], abstained: true, usage };
    }
    // the reader cited (used) some of the shown memories: real implicit feedback for recall learning
    if (agentId === "owner") await this.feedback(r.memories.map((m) => m.id), cited);
    return { ...r, ...extra, answer: content, cited, usage };
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
  async textsFor(ids: string[], viewer?: Viewer): Promise<Record<string, string>> {
    await this.db();
    const rows = this.syncTexts(this.filterSync([...new Set(ids)].slice(0, 5000), viewer));
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
    this.ents?.close();
    this.policy.close();
    await this.mem.close();
    await this.lessonsMem.close();
  }
}
