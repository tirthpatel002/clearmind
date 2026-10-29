#!/usr/bin/env node
// clearmind CLI. Data dir: --dir (default ./.data), owner: --owner (default "me").
import { Clearmind } from "./clearmind.js";
import type { Memory } from "./clearmind.js";
import type { AccessLogEntry } from "./policy.js";

export function fmtMemory(m: Memory): string {
  const st = m.status === "active" ? "" : ` [${m.status}${m.replacedBy ? ` -> ${m.replacedBy}` : ""}]`;
  return `${m.id}${st}  ${m.text}${m.tags.length ? `  #${m.tags.join(" #")}` : ""}`;
}
export function fmtLog(e: AccessLogEntry): string {
  return `#${e.seq} ${e.at} ${e.action.padEnd(6)} agent=${e.agentId} ${e.decision.toUpperCase()} purpose=${e.purpose ?? "-"} scope=[${e.tags.join(",")}] ${e.reason}${e.memoryIds.length ? ` memories=${e.memoryIds.join(",")}` : ""}`;
}

function parse(argv: string[]) {
  const pos: string[] = []; const f: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith("--")) { const n = argv[i + 1]; if (n === undefined || n.startsWith("--")) f[a.slice(2)] = "true"; else { f[a.slice(2)] = n; i++; } }
    else pos.push(a);
  }
  return { pos, f };
}
const list = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);

const USAGE = `clearmind <command> [--dir ./.data] [--owner me]
  remember <text> [--tags a,b] [--key k]     store a memory (same --key replaces the old one)
  update <id> <text>                          new version; old one is marked replaced
  recall <query> [--k 5]                      newest version wins
  list [--all]                                memories (--all includes replaced)
  history <id>                                version chain
  grant --agent A --tags a,b --purposes p,q --consent-by me [--ttl-min 60]
  read --agent A --query Q [--purpose P] [--tags a]
  revoke <grantId> [--by me]
  grants | log [--agent A]`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { pos, f } = parse(argv);
  const [cmd, ...rest] = pos;
  if (!cmd || cmd === "help") { console.log(USAGE); return 0; }
  const cm = new Clearmind({ dir: f.dir ?? ".data", ownerId: f.owner ?? "me" });
  try {
    switch (cmd) {
      case "remember": console.log(fmtMemory(await cm.remember(rest.join(" "), { tags: list(f.tags), key: f.key }))); break;
      case "update": console.log(fmtMemory(await cm.update(rest[0]!, rest.slice(1).join(" ")))); break;
      case "recall": for (const m of await cm.recall(rest.join(" "), Number(f.k ?? 5))) console.log(fmtMemory(m)); break;
      case "list": for (const m of await cm.list(f.all === "true")) console.log(fmtMemory(m)); break;
      case "history": for (const m of await cm.history(rest[0]!)) console.log(fmtMemory(m)); break;
      case "grant": {
        const g = cm.grant({ agentId: f.agent!, tags: list(f.tags) ?? [], purposes: list(f.purposes) ?? [], consentBy: f["consent-by"]!,
          ttlMs: f["ttl-min"] ? Number(f["ttl-min"]) * 60_000 : null });
        console.log(JSON.stringify(g)); break;
      }
      case "read": {
        const r = await cm.read({ agentId: f.agent!, purpose: f.purpose, tags: list(f.tags), query: f.query ?? rest.join(" ") });
        console.log(`${r.decision.toUpperCase()}: ${r.reason}`); for (const m of r.memories) console.log("  " + fmtMemory(m));
        return r.decision === "allowed" ? 0 : 3;
      }
      case "revoke": console.log(JSON.stringify(cm.revoke(rest[0]!, f.by ?? f.owner ?? "me"))); break;
      case "grants": for (const g of cm.policy.listGrants(f.owner ?? "me")) console.log(JSON.stringify(g)); break;
      case "log": for (const e of cm.accessLog(f.agent)) console.log(fmtLog(e)); break;
      default: console.error(USAGE); return 2;
    }
    return 0;
  } catch (e) { console.error(`error: ${(e as Error).message}`); return 1; }
  finally { await cm.close(); }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
  main().then((c) => { process.exitCode = c; });
}
