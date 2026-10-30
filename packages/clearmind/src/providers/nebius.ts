// Nebius Token Factory provider (OpenAI-compatible). The API key comes from the environment only:
// config names the env var (nebius.apiKeyEnv) and it is read at call time, never stored or printed.
import { createOpenAICompatEmbedder } from "agentmemory";
import type { Embedder, LLM } from "agentmemory";
import { DEFAULTS } from "../config.js";
import type { Config } from "../config.js";
import type { SpendLedger } from "../spend.js";
import type { ChatResult } from "../types.js";
import type { ChatMessage, ChatOptions, ModelProvider } from "./provider.js";

type NebiusConfig = Pick<Config, "nebius">;

const apiKey = (cfg: NebiusConfig) => process.env[cfg.nebius.apiKeyEnv] ?? "";

export function hasNebiusKey(cfg: NebiusConfig = DEFAULTS): boolean {
  return !!process.env[cfg.nebius.apiKeyEnv];
}

/** Chat client. Every call is checked against the spend caps first and metered after. */
export function nebiusChat(ledger: SpendLedger, cfg: NebiusConfig = DEFAULTS, user?: string) {
  const model = cfg.nebius.chatModel;
  const call = async (messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> => {
    ledger.check(user);
    const t0 = Date.now();
    const r = await fetch(`${cfg.nebius.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey(cfg)}` },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? cfg.nebius.maxTokens,
        temperature: 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = String(j?.error?.message ?? j?.detail ?? "error").slice(0, 200);
      throw new Error(`model call ${r.status}: ${msg}`);
    }
    const pt = j.usage?.prompt_tokens ?? 0;
    const ct = j.usage?.completion_tokens ?? 0;
    const usd = ledger.add(model, "chat", pt, ct, user);
    const content = String(j.choices?.[0]?.message?.content ?? "").trim();
    return { content, promptTokens: pt, completionTokens: ct, usd, model, ms: Date.now() - t0 };
  };
  const llm: LLM = async (messages, opts) => (await call(messages, { json: opts.json })).content;
  return { call, llm, model };
}

/** Max memoised query embeddings per embedder. */
export const EMBED_CACHE_MAX = 512;

/** Embedder (Qwen3 by default), batched, metered and capped like chat. */
export function nebiusEmbedder(ledger: SpendLedger, cfg: NebiusConfig = DEFAULTS, user?: string): Embedder {
  const model = cfg.nebius.embedModel;
  const raw = createOpenAICompatEmbedder({
    baseURL: cfg.nebius.baseUrl,
    model,
    apiKey: apiKey(cfg),
    batchSize: 32,
    onUsage: (u: { totalTokens: number }) => {
      ledger.add(model, "embed", u.totalTokens, 0, user);
    },
  } as any);
  // Query embeddings repeat within one answer (recall, answerability cosine, inspector), so single-text
  // calls are memoised (LRU, in-flight dedupe). Batches (ingest) go straight through.
  const cache = new Map<string, Promise<Float32Array[]>>();
  return async (texts) => {
    if (texts.length !== 1) { ledger.check(user); return raw(texts); }
    const k = texts[0]!;
    const hit = cache.get(k);
    if (hit) { cache.delete(k); cache.set(k, hit); return hit; }
    ledger.check(user);
    const p = raw(texts);
    cache.set(k, p);
    p.catch(() => cache.delete(k));
    if (cache.size > EMBED_CACHE_MAX) cache.delete(cache.keys().next().value!);
    return p;
  };
}

/** The Nebius implementation of ModelProvider, metered for one user. */
export function nebiusProvider(ledger: SpendLedger, cfg: NebiusConfig = DEFAULTS, user?: string): ModelProvider {
  const chat = nebiusChat(ledger, cfg, user);
  return { chat: (m, o) => chat.call(m, o), llm: chat.llm, embedder: nebiusEmbedder(ledger, cfg, user) };
}
