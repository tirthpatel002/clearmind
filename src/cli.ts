#!/usr/bin/env node
// clearmind CLI. Data dir: --dir (default from config), user: --user (required for data commands).
import { Clearmind } from "./clearmind.js";
import { loadConfig } from "./config.js";
import type { Memory } from "./clearmind.js";
import type { AccessLogEntry } from "./policy.js";

export function fmtMemory(m: Memory): string {
  const st = m.status === "active" ? "" : ` [${m.status}${m.replacedBy ? ` -> ${m.replacedBy}` : ""}]`;
  return `${m.id}${st}  ${m.text}${m.tags.length ? `  #${m.tags.join(" #")}` : ""}  (conf ${m.confidence}${m.confirmations ? `, confirmed x${m.confirmations}` : ""})`;
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

const USAGE = `clearmind <command> [--dir ./.data] --user <id>   (config: CLEARMIND_* env or <dir>/clearmind.config.json)
  remember <text> [--tags a,b] [--key k]     store a memory (same --key replaces the old one)
  update <id> <text>                          new version; old one is marked replaced
  recall <query> [--k 5]                      newest version wins
  list [--all]                                memories (--all includes replaced)
  history <id>                                version chain
  grant --agent A --tags a,b --purposes p,q --consent-by me [--ttl-min 60]
  read --agent A --query Q [--purpose P] [--tags a]
  revoke <grantId> [--by me]
  grants | log [--agent A]
  confirm <id>                                still true: confidence rises, decay restarts
  conflicts | patterns                        learning memory
  lessons --agent A                           distilled agent lessons
  ask <question> [--agent A --purpose P --tags a]   answer from memory via Nemotron (policy enforced)
  serve [--port 8790] [--user id]             local web app (127.0.0.1 only unless allowPublic)
  global: --offline (no Nebius calls)`;

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { pos, f } = parse(argv);
  const [cmd, ...rest] = pos;
  if (!cmd || cmd === "help") { console.log(USAGE); return 0; }
  if (cmd === "serve") {
    const { serve } = await import("./server.js");
    await serve({ offline: f.offline === "true", overrides: { dataDir: f.dir, port: f.port ? Number(f.port) : undefined, host: f.host, "auth.defaultUser": f.user ?? f.owner } });
    return 0;
  }
  const cfg = loadConfig({ overrides: { dataDir: f.dir } });
  const owner = f.user ?? f.owner ?? process.env.CLEARMIND_USER ?? cfg.auth.defaultUser;
  if (!owner) { console.error("error: pass --user <id> (or set CLEARMIND_USER)"); return 2; }
  const cm = Clearmind.fromEnv(cfg.dataDir, owner, { offline: f.offline === "true", config: cfg });
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
      case "revoke": console.log(JSON.stringify(cm.revoke(rest[0]!, f.by ?? owner))); break;
      case "grants": for (const g of cm.policy.listGrants(owner)) console.log(JSON.stringify(g)); break;
      case "log": for (const e of cm.accessLog(f.agent)) console.log(fmtLog(e)); break;
      case "confirm": console.log(fmtMemory(await cm.confirm(rest[0]!))); break;
      case "conflicts": for (const c of await cm.conflicts()) console.log(`CONFLICT ${c.a} <> ${c.b}: ${c.reason} (sim ${c.similarity})`); break;
      case "patterns": for (const p of await cm.patterns()) console.log(`${p.label}  support=${p.support} days=${p.distinctDays} confidence=${p.confidence} evidence=${p.evidence.join(",")}`); break;
      case "lessons": for (const l of await cm.lessons(f.agent ?? "agent")) console.log(`${l.lessonId} [${l.status} ${l.kind} conf ${l.confidence}] ${l.text}  (when: ${l.trigger})`); break;
      case "ask": {
        const r = await cm.ask(rest.join(" "), { agentId: f.agent, purpose: f.purpose, tags: list(f.tags) });
        console.log(r.answer);
        if (r.cited.length) console.log(`cited: ${r.cited.join(", ")}`);
        if (r.usage) console.log(`(${r.usage.model}, ${r.usage.promptTokens}+${r.usage.completionTokens} tok, $${r.usage.usd.toFixed(5)}, ${r.usage.ms} ms)`);
        return r.decision === "allowed" ? 0 : 3;
      }
      default: console.error(USAGE); return 2;
    }
    return 0;
  } catch (e) { console.error(`error: ${(e as Error).message}`); return 1; }
  finally { await cm.close(); }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("cli.js") || process.argv[1]?.endsWith("cli.ts")) {
  main().then((c) => { process.exitCode = c; });
}
