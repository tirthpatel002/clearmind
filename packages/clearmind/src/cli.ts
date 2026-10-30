// clearmind CLI (data commands). Data dir: --dir (default from config), user: --user (required).
// The `serve` command lives in the server package, whose `clearmind` bin wraps this one.
import { loadConfig } from "./config.js";
import { fmtLog, fmtMemory } from "./format.js";
import { Clearmind } from "./store.js";

export type Flags = Record<string, string>;

/** Split argv into positionals and --flags (a flag without a value is "true"). */
export function parseArgs(argv: string[]): { pos: string[]; f: Flags } {
  const pos: string[] = [];
  const f: Flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) {
      pos.push(a);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) f[a.slice(2)] = "true";
    else {
      f[a.slice(2)] = next;
      i++;
    }
  }
  return { pos, f };
}

const list = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : undefined);

export const USAGE = `clearmind <command> [--dir ./.data] --user <id>   (config: CLEARMIND_* env or <dir>/clearmind.config.json)
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
  entities [--type person] [--q text]         people, orgs, products, places linked to memories
  entity <id|name>                            one entity: fields with sources, history, linked memories
  backfill-entities                           extract and link entities for existing memories (idempotent; back up first)
  serve [--port 8790] [--user id]             local web app (127.0.0.1 only unless allowPublic)
  global: --offline (no Nebius calls)`;

/** Run one data command. Returns the process exit code (0 ok, 1 error, 2 usage, 3 denied). */
export async function main(argv = process.argv.slice(2)): Promise<number> {
  const { pos, f } = parseArgs(argv);
  const [cmd, ...rest] = pos;
  if (!cmd || cmd === "help") {
    console.log(USAGE);
    return 0;
  }
  if (cmd === "serve") {
    console.error("error: serve is provided by the server package (pnpm serve, or the clearmind bin in server/)");
    return 2;
  }
  const cfg = loadConfig({ overrides: { dataDir: f.dir } });
  const owner = f.user ?? f.owner ?? process.env.CLEARMIND_USER ?? cfg.auth.defaultUser;
  if (!owner) {
    console.error("error: pass --user <id> (or set CLEARMIND_USER)");
    return 2;
  }
  const cm = Clearmind.fromEnv(cfg.dataDir, owner, { offline: f.offline === "true", config: cfg });
  try {
    return await run(cm, owner, cmd, rest, f);
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    return 1;
  } finally {
    await cm.close();
  }
}

async function run(cm: Clearmind, owner: string, cmd: string, rest: string[], f: Flags): Promise<number> {
  const print = (s: string) => console.log(s);
  switch (cmd) {
    case "entities":
      for (const e of cm.entities.list({ type: f.type, q: f.q })) print(`${e.id}  ${(e.type ?? "-").padEnd(10)} ${String(e.memoryCount ?? 0).padStart(4)}  ${e.name}${e.aliases.length ? "  (" + e.aliases.join(", ") + ")" : ""}`);
      return 0;
    case "entity": {
      const id = rest.join(" "), e = cm.entities.detail(id) ?? (cm.entities.resolve(id) ? cm.entities.detail(cm.entities.resolve(id)!.id) : null);
      if (!e) throw new Error(`no entity "${id}"`);
      print(JSON.stringify(e, null, 2));
      return 0;
    }
    case "backfill-entities":
      print(JSON.stringify(await cm.backfillEntities()));
      return 0;
    case "remember":
      print(fmtMemory(await cm.remember(rest.join(" "), { tags: list(f.tags), key: f.key })));
      return 0;
    case "update":
      print(fmtMemory(await cm.update(rest[0]!, rest.slice(1).join(" "))));
      return 0;
    case "recall":
      for (const m of await cm.recall(rest.join(" "), Number(f.k ?? 5))) print(fmtMemory(m));
      return 0;
    case "list":
      for (const m of await cm.list(f.all === "true")) print(fmtMemory(m));
      return 0;
    case "history":
      for (const m of await cm.history(rest[0]!)) print(fmtMemory(m));
      return 0;
    case "grant": {
      const ttlMs = f["ttl-min"] ? Number(f["ttl-min"]) * 60_000 : null;
      const g = cm.grant({
        agentId: f.agent!, tags: list(f.tags) ?? [], purposes: list(f.purposes) ?? [], consentBy: f["consent-by"]!, ttlMs,
      });
      print(JSON.stringify(g));
      return 0;
    }
    case "read": {
      const r = await cm.read({ agentId: f.agent!, purpose: f.purpose, tags: list(f.tags), query: f.query ?? rest.join(" ") });
      print(`${r.decision.toUpperCase()}: ${r.reason}`);
      for (const m of r.memories) print("  " + fmtMemory(m));
      return r.decision === "allowed" ? 0 : 3;
    }
    case "revoke":
      print(JSON.stringify(cm.revoke(rest[0]!, f.by ?? owner)));
      return 0;
    case "grants":
      for (const g of cm.policy.listGrants(owner)) print(JSON.stringify(g));
      return 0;
    case "log":
      for (const e of cm.accessLog(f.agent)) print(fmtLog(e));
      return 0;
    case "confirm":
      print(fmtMemory(await cm.confirm(rest[0]!)));
      return 0;
    case "conflicts":
      for (const c of await cm.conflicts()) print(`CONFLICT ${c.a} <> ${c.b}: ${c.reason} (sim ${c.similarity})`);
      return 0;
    case "patterns":
      for (const p of await cm.patterns()) {
        print(`${p.label}  support=${p.support} days=${p.distinctDays} confidence=${p.confidence} evidence=${p.evidence.join(",")}`);
      }
      return 0;
    case "lessons":
      for (const l of await cm.lessons(f.agent ?? "agent")) {
        print(`${l.lessonId} [${l.status} ${l.kind} conf ${l.confidence}] ${l.text}  (when: ${l.trigger})`);
      }
      return 0;
    case "ask": {
      const r = await cm.ask(rest.join(" "), { agentId: f.agent, purpose: f.purpose, tags: list(f.tags) });
      print(r.answer);
      if (r.cited.length) print(`cited: ${r.cited.join(", ")}`);
      if (r.usage) {
        const u = r.usage;
        print(`(${u.model}, ${u.promptTokens}+${u.completionTokens} tok, $${u.usd.toFixed(5)}, ${u.ms} ms)`);
      }
      return r.decision === "allowed" ? 0 : 3;
    }
    default:
      console.error(USAGE);
      return 2;
  }
}
