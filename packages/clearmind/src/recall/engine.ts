// Opt-in agentmemory recall engine: maps config.retrieval onto EnhancedRetriever + GuardedStore.
// With every option at its default, Clearmind keeps the previous SqliteStore + HybridRetriever path.
import { join } from "node:path";
import { AuditLog, clauseFactExtractor, EnhancedRetriever, GuardedStore, HybridRetriever, LexicalOverlapReranker, SqliteStore } from "agentmemory";
import type { Embedder, EnhancedRetrieverOptions, FusionMode, MemoryStore, Principal, RedactionMode, Retriever } from "agentmemory";

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
}

export const RETRIEVAL_DEFAULTS: Retrieval = {
  fusion: "none", fusionAlpha: 0.5, rrfK: 60,
  rerank: "off", rerankWeight: 0.5, rerankPool: 50,
  factKeys: false, types: [], typeBoost: {},
  newestFirst: false, supersededPenalty: 0.5, includeSuperseded: true,
  multiHop: false, multiHopTop: 3,
  principal: null, redaction: "off", audit: false, hardForget: false,
};

export const retrieval = (r?: Partial<Retrieval>): Retrieval => ({ ...structuredClone(RETRIEVAL_DEFAULTS), ...(r ?? {}) });

/** Options that change recall ranking (need EnhancedRetriever). */
export function enhancedOn(r: Retrieval): boolean {
  return r.fusion !== "none" || r.rerank !== "off" || r.factKeys || r.types.length > 0 || Object.keys(r.typeBoost).length > 0
    || r.newestFirst || r.multiHop || r.principal !== null || r.audit;
}
/** Options that change writes (need GuardedStore). */
export const guardOn = (r: Retrieval): boolean => r.redaction !== "off" || r.factKeys || r.audit;

export function retrieverOptions(r: Retrieval, o: { now: () => Date; embedder?: Embedder | undefined; audit?: AuditLog | undefined }): EnhancedRetrieverOptions {
  return {
    now: o.now, fusion: r.fusion, fusionAlpha: r.fusionAlpha, rrfK: r.rrfK,
    useFactKeys: r.factKeys, types: r.types.length ? r.types : undefined, typeBoost: Object.keys(r.typeBoost).length ? r.typeBoost : undefined,
    newestFirst: r.newestFirst, supersededPenalty: r.supersededPenalty, includeSuperseded: r.includeSuperseded,
    principal: r.principal ?? undefined,
    reranker: r.rerank === "lexical" ? new LexicalOverlapReranker(r.rerankWeight) : undefined, rerankPool: r.rerankPool,
    multiHop: r.multiHop, multiHopTop: r.multiHopTop, embedder: o.embedder, audit: o.audit,
  };
}

export interface Engine { store: MemoryStore; retriever: Retriever; audit: AuditLog | null; enhanced: EnhancedRetriever | null }

export function buildEngine(dir: string, r: Retrieval, o: { now: () => Date; embedder?: Embedder | undefined }): Engine {
  const base = new SqliteStore({ path: join(dir, "memory.db") });
  const audit = r.audit ? new AuditLog(join(dir, "audit.jsonl"), o.now) : null;
  const store: MemoryStore = guardOn(r)
    ? new GuardedStore(base, { redaction: r.redaction, factExtractor: r.factKeys ? clauseFactExtractor : undefined, embedder: r.factKeys ? o.embedder : undefined, audit: audit ?? undefined })
    : base;
  const enhanced = enhancedOn(r) ? new EnhancedRetriever(retrieverOptions(r, { ...o, audit: audit ?? undefined })) : null;
  return { store, retriever: enhanced ?? new HybridRetriever({ now: o.now }), audit, enhanced };
}
