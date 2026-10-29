// Nebius Token Factory client (OpenAI-compatible). Key comes from the environment only (name set in config).
import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { createOpenAICompatEmbedder } from "agentmemory";
import type { Embedder, LLM } from "agentmemory";
import { DEFAULTS } from "./config.js";
import type { Config } from "./config.js";

/** Append-only spend ledger shared by all users, with a global cap and a per-user cap. */
export class SpendLedger {
  private cache: { size: number; total: number; byUser: Map<string, number> } | null = null;
  constructor(readonly path: string, readonly caps: { globalCapUsd: number; perUserCapUsd: number } = DEFAULTS.spend,
    readonly prices: Config["nebius"]["prices"] = DEFAULTS.nebius.prices) {}
  private read() {
    const size = existsSync(this.path) ? statSync(this.path).size : 0;
    if (this.cache?.size === size) return this.cache;
    const byUser = new Map<string, number>(); let total = 0;
    if (size) for (const l of readFileSync(this.path, "utf8").split("\n")) {
      if (!l) continue; const e = JSON.parse(l); total += e.usd ?? 0; const u = e.user ?? "_"; byUser.set(u, (byUser.get(u) ?? 0) + (e.usd ?? 0));
    }
    return (this.cache = { size, total, byUser });
  }
  total(user?: string): number { const c = this.read(); return user ? c.byUser.get(user) ?? 0 : c.total; }
  check(user?: string): void {
    const t = this.total();
    if (t >= this.caps.globalCapUsd) throw new Error(`spend cap reached ($${t.toFixed(4)} >= $${this.caps.globalCapUsd})`);
    if (user) { const u = this.total(user); if (u >= this.caps.perUserCapUsd) throw new Error(`your spend cap is reached ($${u.toFixed(4)} >= $${this.caps.perUserCapUsd})`); }
  }
  add(model: string, kind: "chat" | "embed", promptTokens: number, completionTokens: number, user?: string): number {
    const p = this.prices[model] ?? { in: 1, out: 3 };
    const usd = (promptTokens * p.in + completionTokens * p.out) / 1e6;
    appendFileSync(this.path, JSON.stringify({ at: new Date().toISOString(), user: user ?? null, model, kind, promptTokens, completionTokens, usd }) + "\n");
    return usd;
  }
}

export interface ChatResult { content: string; promptTokens: number; completionTokens: number; usd: number; model: string; ms: number }

export function hasNebiusKey(cfg: Pick<Config, "nebius"> = DEFAULTS): boolean { return !!process.env[cfg.nebius.apiKeyEnv]; }

export function nebiusChat(ledger: SpendLedger, cfg: Pick<Config, "nebius"> = DEFAULTS, user?: string) {
  const model = cfg.nebius.chatModel;
  const call = async (messages: { role: string; content: string }[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<ChatResult> => {
    ledger.check(user);
    const t0 = Date.now();
    const r = await fetch(`${cfg.nebius.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[cfg.nebius.apiKeyEnv] ?? ""}` },
      body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens ?? cfg.nebius.maxTokens, temperature: 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`model call ${r.status}: ${String(j?.error?.message ?? j?.detail ?? "error").slice(0, 200)}`);
    const pt = j.usage?.prompt_tokens ?? 0, ct = j.usage?.completion_tokens ?? 0;
    const usd = ledger.add(model, "chat", pt, ct, user);
    return { content: String(j.choices?.[0]?.message?.content ?? "").trim(), promptTokens: pt, completionTokens: ct, usd, model, ms: Date.now() - t0 };
  };
  const llm: LLM = async (messages, opts) => (await call(messages, { json: opts.json })).content;
  return { call, llm, model };
}

export function nebiusEmbedder(ledger: SpendLedger, cfg: Pick<Config, "nebius"> = DEFAULTS, user?: string): Embedder {
  const model = cfg.nebius.embedModel;
  const raw = createOpenAICompatEmbedder({ baseURL: cfg.nebius.baseUrl, model, apiKey: process.env[cfg.nebius.apiKeyEnv] ?? "", batchSize: 32,
    onUsage: (u: { totalTokens: number }) => { ledger.add(model, "embed", u.totalTokens, 0, user); } } as any);
  return async (texts) => { ledger.check(user); return raw(texts); };
}
