// Append-only spend ledger (JSONL) shared by all users, with a global cap and a per-user cap.
import { appendFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { DEFAULTS } from "./config.js";
import type { Config } from "./config.js";

type Prices = Config["nebius"]["prices"];
type Totals = { size: number; total: number; byUser: Map<string, number> };

/** Price used for a model missing from the price table (USD per 1M tokens). */
const FALLBACK_PRICE = { in: 1, out: 3 };

export class SpendLedger {
  private cache: Totals | null = null;

  constructor(
    readonly path: string,
    readonly caps: { globalCapUsd: number; perUserCapUsd: number } = DEFAULTS.spend,
    readonly prices: Prices = DEFAULTS.nebius.prices,
  ) {}

  /** Totals, re-read only when the file size changed (other processes may append too). */
  private read(): Totals {
    const size = existsSync(this.path) ? statSync(this.path).size : 0;
    if (this.cache?.size === size) return this.cache;
    const byUser = new Map<string, number>();
    let total = 0;
    if (size) {
      for (const line of readFileSync(this.path, "utf8").split("\n")) {
        if (!line) continue;
        const e = JSON.parse(line);
        total += e.usd ?? 0;
        const u = e.user ?? "_";
        byUser.set(u, (byUser.get(u) ?? 0) + (e.usd ?? 0));
      }
    }
    return (this.cache = { size, total, byUser });
  }

  total(user?: string): number {
    const c = this.read();
    return user ? (c.byUser.get(user) ?? 0) : c.total;
  }

  /** Throws when the global cap, or this user's cap, is reached. */
  check(user?: string): void {
    const t = this.total();
    if (t >= this.caps.globalCapUsd) {
      throw new Error(`spend cap reached ($${t.toFixed(4)} >= $${this.caps.globalCapUsd})`);
    }
    if (!user) return;
    const u = this.total(user);
    if (u >= this.caps.perUserCapUsd) {
      throw new Error(`your spend cap is reached ($${u.toFixed(4)} >= $${this.caps.perUserCapUsd})`);
    }
  }

  add(model: string, kind: "chat" | "embed", promptTokens: number, completionTokens: number, user?: string): number {
    const p = this.prices[model] ?? FALLBACK_PRICE;
    const usd = (promptTokens * p.in + completionTokens * p.out) / 1e6;
    const entry = { at: new Date().toISOString(), user: user ?? null, model, kind, promptTokens, completionTokens, usd };
    appendFileSync(this.path, JSON.stringify(entry) + "\n");
    return usd;
  }
}
