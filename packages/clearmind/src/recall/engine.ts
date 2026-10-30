// Opt-in agentmemory recall engine: maps config.retrieval onto EnhancedRetriever + GuardedStore.
// With every option at its default, Clearmind keeps the previous SqliteStore + HybridRetriever path.
import { statSync } from "node:fs";
import { join } from "node:path";
import { AuditLog, clauseFactExtractor, EnhancedRetriever, GuardedStore, HybridRetriever, LexicalOverlapReranker, SqliteStore } from "agentmemory";
import type { Embedder, EnhancedRetrieverOptions, Lesson, FusionMode, LearningOptions, MemoryStore, Principal, RedactionMode, Retriever, ScoreModel } from "agentmemory";

export interface Retrieval {
  /** Score fusion of embedding + BM25: none (current behaviour) | weighted | rrf. */
  fusion: FusionMode; fusionAlpha: number; rrfK: number;
  /** Reranker hook over a widened pool: off | lexical (LexicalOverlapReranker). */
  rerank: "off" | "lexical"; rerankWeight: number; rerankPool: number;
  /** Extract clause fact keys at write time (GuardedStore) and match on them at recall. */
  factKeys: boolean;
  /** Keep only these memory types (empty = all) and multiply scores per type. */
  types: string[]; typeBoost: Record<string, number>;
  /** Prefer the newest of superseding memories. */
  newestFirst: boolean; supersededPenalty: number; includeSuperseded: boolean;
  /** Second recall pass from the top results' entities, fused by RRF. */
  multiHop: boolean; multiHopTop: number;
  /** Principal access policy (fail closed); null = scope isolation only. */
  principal: Principal | null;
  /** Write-time redaction of sensitive data: off | redact | mask | reject. */
  redaction: RedactionMode;
  /** Hash-chained audit log at <dataDir>/audit.jsonl (ids only). */
  audit: boolean;
  /** Enable Clearmind.forget(id): hard delete with audit. */
  hardForget: boolean;
  /** Maximal Marginal Relevance after fusion: top-k picked from mmrPool by lambda*rel - (1-lambda)*redundancy. */
  mmr: boolean; mmrLambda: number; mmrPool: number;
  /** Learn recall from real use (citations, corrections, confirmations): Beta helpfulness, ACT-R recency,
   *  Hebbian co-use links and online score weights. Never fed by eval labels. */
  learning: boolean; learningOptions: LearningOptions;
}

export const RETRIEVAL_DEFAULTS: Retrieval = {
  fusion: "none", fusionAlpha: 0.5, rrfK: 60,
  rerank: "off", rerankWeight: 0.5, rerankPool: 50,
  factKeys: false, types: [], typeBoost: {},
  newestFirst: false, supersededPenalty: 0.5, includeSuperseded: true,
  multiHop: false, multiHopTop: 3,
  principal: null, redaction: "off", audit: false, hardForget: false,
  mmr: false, mmrLambda: 0.7, mmrPool: 50,
  learning: false, learningOptions: {},
};

export const retrieval = (r?: Partial<Retrieval>): Retrieval => ({ ...structuredClone(RETRIEVAL_DEFAULTS), ...(r ?? {}) });

/** Options that change recall ranking (need EnhancedRetriever). */
export function enhancedOn(r: Retrieval): boolean {
  return r.fusion !== "none" || r.rerank !== "off" || r.factKeys || r.types.length > 0 || Object.keys(r.typeBoost).length > 0
    || r.newestFirst || r.multiHop || r.principal !== null || r.audit || r.mmr || r.learning;
}
/** Options that change writes (need GuardedStore). */
export const guardOn = (r: Retrieval): boolean => r.redaction !== "off" || r.factKeys || r.audit;

export function retrieverOptions(r: Retrieval, o: { now: () => Date; embedder?: Embedder | undefined; audit?: AuditLog | undefined; model?: () => ScoreModel | null }): EnhancedRetrieverOptions {
  return {
    now: o.now, fusion: r.fusion, fusionAlpha: r.fusionAlpha, rrfK: r.rrfK,
    useFactKeys: r.factKeys, types: r.types.length ? r.types : undefined, typeBoost: Object.keys(r.typeBoost).length ? r.typeBoost : undefined,
    newestFirst: r.newestFirst, supersededPenalty: r.supersededPenalty, includeSuperseded: r.includeSuperseded,
    principal: r.principal ?? undefined,
    reranker: r.rerank === "lexical" ? new LexicalOverlapReranker(r.rerankWeight) : undefined, rerankPool: r.rerankPool,
    multiHop: r.multiHop, multiHopTop: r.multiHopTop, embedder: o.embedder, audit: o.audit,
    noneSimilarity: "hybrid", // keyword search is never dropped when a flag switches on EnhancedRetriever
    mmr: r.mmr, mmrLambda: r.mmrLambda, mmrPool: r.mmrPool,
    learning: r.learning ? { config: r.learningOptions, model: o.model } : undefined,
  };
}

export interface Engine { store: MemoryStore; retriever: Retriever; audit: AuditLog | null; enhanced: EnhancedRetriever | null }

export function buildEngine(dir: string, r: Retrieval, o: { now: () => Date; embedder?: Embedder | undefined; model?: () => ScoreModel | null }): Engine {
  const base = new SqliteStore({ path: join(dir, "memory.db") });
  const audit = r.audit ? new AuditLog(join(dir, "audit.jsonl"), o.now) : null;
  const store: MemoryStore = guardOn(r)
    ? new GuardedStore(base, { redaction: r.redaction, factExtractor: r.factKeys ? clauseFactExtractor : undefined, embedder: r.factKeys ? o.embedder : undefined, audit: audit ?? undefined })
    : base;
  const enhanced = enhancedOn(r) ? new EnhancedRetriever(retrieverOptions(r, { ...o, audit: audit ?? undefined })) : null;
  return { store: cachedLessons(store, join(dir, "memory.db")), retriever: enhanced ?? new HybridRetriever({ now: o.now }), audit, enhanced };
}

/**
 * Read-through cache for listLessons: every recall loads all active lessons (5k rows with 4096-d vectors took
 * ~370 ms). Entries are dropped on any write through this store and whenever memory.db or its WAL changes on disk
 * (writes from another process, e.g. a CLI ingest). Callers get a fresh array; lessons are shared, read-only.
 */
export function cachedLessons(store: MemoryStore, dbPath: string): MemoryStore {
  const cache = new Map<string, Lesson[]>();
  const stamp = () => { let o = ""; for (const f of [dbPath, dbPath + "-wal"]) { try { const st = statSync(f); o += st.mtimeMs + ":" + st.size + ";"; } catch { o += "-;"; } } return o; };
  return new Proxy(store, {
    get(t, k, r) {
      const v = Reflect.get(t, k, r);
      if (typeof v !== "function") return v;
      if (k === "listLessons") return async (scope: unknown, q?: unknown) => {
        const key = JSON.stringify([scope, q ?? null]) + "@" + stamp();
        const hit = cache.get(key); if (hit) return hit.slice();
        const got: Lesson[] = await v.call(t, scope, q);
        if (cache.size > 32) cache.clear();
        cache.set(key, got); return got.slice();
      };
      if (/^(insert|update|delete|upsert|transaction|close|init)/.test(String(k))) return (...a: unknown[]) => { cache.clear(); return v.apply(t, a); };
      return v.bind(t);
    },
  });
}
