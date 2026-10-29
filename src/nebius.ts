// Nebius Token Factory client (OpenAI-compatible). Key comes from the environment only.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createOpenAICompatEmbedder } from "agentmemory";
import type { Embedder, LLM } from "agentmemory";

export const NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1";
export const DEFAULT_CHAT_MODEL = "nvidia/Nemotron-3-Ultra-550b-a55b";
export const DEFAULT_EMBED_MODEL = "Qwen/Qwen3-Embedding-8B";
// USD per 1M tokens (Token Factory catalog, Oct 2026)
const PRICES: Record<string, { in: number; out: number }> = {
  "nvidia/Nemotron-3-Ultra-550b-a55b": { in: 1.0, out: 3.0 },
  "nvidia/nemotron-3-super-120b-a12b": { in: 0.3, out: 0.9 },
  "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B": { in: 0.06, out: 0.24 },
  "Qwen/Qwen3-Embedding-8B": { in: 0.01, out: 0 },
};

/** Append-only spend ledger with a hard cap (CLEARMIND_SPEND_CAP_USD, default 1). */
export class SpendLedger {
  constructor(readonly path: string, readonly capUsd = Number(process.env.CLEARMIND_SPEND_CAP_USD ?? 1)) {}
  total(): number {
    if (!existsSync(this.path)) return 0;
    return readFileSync(this.path, "utf8").trim().split("\n").filter(Boolean).reduce((s, l) => s + (JSON.parse(l).usd ?? 0), 0);
  }
  check(): void {
    const t = this.total();
    if (t >= this.capUsd) throw new Error(`Nebius spend cap reached ($${t.toFixed(4)} >= $${this.capUsd})`);
  }
  add(model: string, kind: "chat" | "embed", promptTokens: number, completionTokens: number): number {
    const p = PRICES[model] ?? { in: 1, out: 3 };
    const usd = (promptTokens * p.in + completionTokens * p.out) / 1e6;
    appendFileSync(this.path, JSON.stringify({ at: new Date().toISOString(), model, kind, promptTokens, completionTokens, usd }) + "\n");
    return usd;
  }
}

export interface ChatResult { content: string; promptTokens: number; completionTokens: number; usd: number; model: string; ms: number }

export function hasNebiusKey(): boolean { return !!process.env.NEBIUS_API_KEY; }

export function nebiusChat(ledger: SpendLedger, model = process.env.CLEARMIND_CHAT_MODEL ?? DEFAULT_CHAT_MODEL) {
  const call = async (messages: { role: string; content: string }[], opts: { json?: boolean; maxTokens?: number } = {}): Promise<ChatResult> => {
    ledger.check();
    const t0 = Date.now();
    const r = await fetch(`${NEBIUS_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NEBIUS_API_KEY ?? ""}` },
      body: JSON.stringify({ model, messages, max_tokens: opts.maxTokens ?? 1500, temperature: 0.2,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}) }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`Nebius chat ${r.status}: ${String(j?.error?.message ?? j?.detail ?? "error").slice(0, 200)}`);
    const pt = j.usage?.prompt_tokens ?? 0, ct = j.usage?.completion_tokens ?? 0;
    const usd = ledger.add(model, "chat", pt, ct);
    return { content: String(j.choices?.[0]?.message?.content ?? "").trim(), promptTokens: pt, completionTokens: ct, usd, model, ms: Date.now() - t0 };
  };
  const llm: LLM = async (messages, opts) => (await call(messages, { json: opts.json })).content;
  return { call, llm, model };
}

export function nebiusEmbedder(ledger: SpendLedger, model = DEFAULT_EMBED_MODEL): Embedder {
  const raw = createOpenAICompatEmbedder({ baseURL: NEBIUS_BASE_URL, model, apiKey: process.env.NEBIUS_API_KEY ?? "", batchSize: 32,
    onUsage: (u: { totalTokens: number }) => { ledger.add(model, "embed", u.totalTokens, 0); } } as any);
  return async (texts) => { ledger.check(); return raw(texts); };
}
