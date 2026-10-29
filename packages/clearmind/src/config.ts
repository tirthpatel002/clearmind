// Runtime configuration. Defaults < JSON file (CLEARMIND_CONFIG or <dataDir>/clearmind.config.json) < CLEARMIND_* env vars.
// Secrets are never part of the config: the API key is read from the env var named in nebius.apiKeyEnv at call time.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface Config {
  host: string; port: number; dataDir: string; allowPublic: boolean;
  nebius: { baseUrl: string; chatModel: string; embedModel: string; apiKeyEnv: string; maxTokens: number; prices: Record<string, { in: number; out: number }> };
  recall: { minSimilarity: number; minLexicalSimilarity: number; abstain: { enabled: boolean; alpha: number; minEvidence: number; minEvidenceLexical: number } };
  confidence: { halfLifeDays: number; gain: number; floor: number; initial: number };
  duplicates: { threshold: number };
  conflicts: { minSimilarityEmbedding: number; minSimilarityLexical: number };
  patterns: { minSupport: number; minDays: number; minShared: number; embeddingLink: number };
  spend: { globalCapUsd: number; perUserCapUsd: number };
  rateLimit: { requestsPerMin: number; modelCallsPerMin: number };
  auth: { provider: "local"; defaultUser: string | null };
  ui: { pageSize: number; clusterAbove: number; maxNodes: number };
  import: { maxItems: number; maxBytes: number };
  /** Opt-in recall/answer features (see features/config.ts); omitted = all off. */
  /** Opt-in agentmemory EnhancedRetriever/GuardedStore options (see recall/engine.ts); omitted = current path. */
  retrieval?: Partial<import("./recall/engine.js").Retrieval>;
  features?: { [K in keyof import("./features/config.js").Features]?: Partial<import("./features/config.js").Features[K]> };
}

export const DEFAULTS: Config = {
  host: "127.0.0.1", port: 8790, dataDir: ".data", allowPublic: false,
  nebius: {
    baseUrl: "https://api.tokenfactory.nebius.com/v1", chatModel: "nvidia/Nemotron-3-Ultra-550b-a55b", embedModel: "Qwen/Qwen3-Embedding-8B",
    apiKeyEnv: "NEBIUS_API_KEY", maxTokens: 1500,
    prices: { // USD per 1M tokens (Token Factory catalog, Oct 2026)
      "nvidia/Nemotron-3-Ultra-550b-a55b": { in: 1.0, out: 3.0 }, "nvidia/nemotron-3-super-120b-a12b": { in: 0.3, out: 0.9 },
      "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": { in: 0.06, out: 0.24 }, "Qwen/Qwen3-Embedding-8B": { in: 0.01, out: 0 },
    },
  },
  recall: { minSimilarity: 0.5, minLexicalSimilarity: 0.05, abstain: { enabled: true, alpha: 0.7, minEvidence: 0.35, minEvidenceLexical: 0.34 } },
  confidence: { halfLifeDays: 30, gain: 0.4, floor: 0.05, initial: 0.6 },
  duplicates: { threshold: 0.8 },
  conflicts: { minSimilarityEmbedding: 0.75, minSimilarityLexical: 0.3 },
  patterns: { minSupport: 3, minDays: 2, minShared: 2, embeddingLink: 0.8 },
  spend: { globalCapUsd: 1, perUserCapUsd: 0.25 },
  rateLimit: { requestsPerMin: 600, modelCallsPerMin: 30 },
  auth: { provider: "local", defaultUser: null },
  ui: { pageSize: 50, clusterAbove: 150, maxNodes: 150 },
  import: { maxItems: 1000, maxBytes: 2_000_000 },
};

type Env = Record<string, string | undefined>;
const num = (v: string) => { const n = Number(v); if (!Number.isFinite(n)) throw new Error(`config: "${v}" is not a number`); return n; };
const bool = (v: string) => /^(1|true|yes)$/i.test(v);
const str = (v: string) => v;
/** env var -> [path, parser] */
export const ENV_MAP: Record<string, [string, (v: string) => unknown]> = {
  CLEARMIND_HOST: ["host", str], CLEARMIND_PORT: ["port", num], CLEARMIND_DATA_DIR: ["dataDir", str], CLEARMIND_ALLOW_PUBLIC: ["allowPublic", bool],
  CLEARMIND_BASE_URL: ["nebius.baseUrl", str], CLEARMIND_CHAT_MODEL: ["nebius.chatModel", str], CLEARMIND_EMBED_MODEL: ["nebius.embedModel", str],
  CLEARMIND_API_KEY_ENV: ["nebius.apiKeyEnv", str], CLEARMIND_MAX_TOKENS: ["nebius.maxTokens", num],
  CLEARMIND_MIN_SIMILARITY: ["recall.minSimilarity", num], CLEARMIND_ABSTAIN: ["recall.abstain.enabled", bool], CLEARMIND_ABSTAIN_MIN_EVIDENCE: ["recall.abstain.minEvidence", num], CLEARMIND_ABSTAIN_MIN_EVIDENCE_LEXICAL: ["recall.abstain.minEvidenceLexical", num], CLEARMIND_HALF_LIFE_DAYS: ["confidence.halfLifeDays", num],
  CLEARMIND_DUPLICATE_THRESHOLD: ["duplicates.threshold", num],
  CLEARMIND_PATTERN_MIN_SUPPORT: ["patterns.minSupport", num], CLEARMIND_PATTERN_MIN_DAYS: ["patterns.minDays", num],
  CLEARMIND_PATTERN_EMBED_LINK: ["patterns.embeddingLink", num],
  CLEARMIND_SPEND_CAP_USD: ["spend.globalCapUsd", num], CLEARMIND_USER_SPEND_CAP_USD: ["spend.perUserCapUsd", num],
  CLEARMIND_RATE_LIMIT_PER_MIN: ["rateLimit.requestsPerMin", num], CLEARMIND_MODEL_RATE_LIMIT_PER_MIN: ["rateLimit.modelCallsPerMin", num],
  CLEARMIND_DEFAULT_USER: ["auth.defaultUser", str], CLEARMIND_PAGE_SIZE: ["ui.pageSize", num], CLEARMIND_CLUSTER_ABOVE: ["ui.clusterAbove", num],
};

function merge<T>(a: T, b: any): T {
  if (!b || typeof b !== "object" || Array.isArray(b)) return (b ?? a) as T;
  const out: any = { ...(a as any) };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" ? merge(out[k], v) : v;
  return out;
}
function setPath(o: any, path: string, v: unknown) { const ks = path.split("."); let c = o; for (const k of ks.slice(0, -1)) c = c[k] ??= {}; c[ks.at(-1)!] = v; }

export function loadConfig(o: { env?: Env; file?: string; overrides?: Partial<Record<string, unknown>> } = {}): Config {
  const env = o.env ?? process.env;
  let cfg: Config = structuredClone(DEFAULTS);
  const dataDir = env.CLEARMIND_DATA_DIR ?? (o.overrides?.dataDir as string | undefined) ?? cfg.dataDir;
  const file = o.file ?? env.CLEARMIND_CONFIG ?? join(dataDir, "clearmind.config.json");
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, "utf8"));
    if (JSON.stringify(j).match(/"(api_?key|secret|token)"\s*:/i)) throw new Error("config: secrets do not belong in the config file; use the environment");
    cfg = merge(cfg, j);
  }
  for (const [k, [path, parse]] of Object.entries(ENV_MAP)) if (env[k] !== undefined && env[k] !== "") setPath(cfg, path, parse(env[k]!));
  for (const [k, v] of Object.entries(o.overrides ?? {})) if (v !== undefined) setPath(cfg, k, v);
  validate(cfg);
  return cfg;
}

export function isLoopback(h: string): boolean { return h === "127.0.0.1" || h === "::1" || h === "localhost"; }

function validate(c: Config) {
  const p = (ok: boolean, m: string) => { if (!ok) throw new Error(`config: ${m}`); };
  p(Number.isInteger(c.port) && c.port > 0 && c.port < 65536, "port must be 1-65535");
  p(isLoopback(c.host) || c.allowPublic, `host ${c.host} is not loopback; set allowPublic (CLEARMIND_ALLOW_PUBLIC=1) deliberately to expose it`);
  for (const [k, v] of [["recall.minSimilarity", c.recall.minSimilarity], ["duplicates.threshold", c.duplicates.threshold], ["patterns.embeddingLink", c.patterns.embeddingLink]] as const) p(v >= 0 && v <= 1, `${k} must be 0..1`);
  p(c.confidence.halfLifeDays > 0, "confidence.halfLifeDays must be > 0");
  p(c.patterns.minSupport >= 2 && c.patterns.minDays >= 1, "patterns.minSupport >= 2 and minDays >= 1");
  p(c.spend.globalCapUsd >= 0 && c.spend.perUserCapUsd >= 0, "spend caps must be >= 0");
  p(c.rateLimit.requestsPerMin > 0 && c.rateLimit.modelCallsPerMin > 0, "rate limits must be > 0");
  p(c.auth.defaultUser === null || validUserId(c.auth.defaultUser), "auth.defaultUser is not a valid user id");
}

export function validUserId(u: unknown): u is string { return typeof u === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(u); }
