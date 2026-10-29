// Build a large SEPARATE test workspace (no model or embedding calls): N memories + M access-log rows.
// Usage: node --import tsx scripts/scale.ts --dir <dataDir> --user <id> [--memories 10000] [--log 50000]
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { Clearmind } from "@clearmind/core";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const dir = arg("dir"), user = arg("user"); const N = Number(arg("memories", "10000")), M = Number(arg("log", "50000"));
if (!dir || !user) { console.error("usage: scale.ts --dir <dataDir> --user <id>"); process.exit(2); }
if (existsSync(dir)) rmSync(dir, { recursive: true });
const scopes = ["food", "health", "work", "travel", "family", "finance", "home", "fitness", "music", "reading", "pets", "shopping"];
const words = "coffee tea paneer run gym flight hotel meeting standup invoice rent dog cat guitar novel budget laptop train bus doctor dentist yoga pasta sushi market report deadline client mom dad birthday".split(" ");
const cm = new Clearmind({ dir, ownerId: user });
for (const s of scopes) cm.addScope(s);
await cm.remember("seed memory", { tags: ["misc"] });
cm.grant({ agentId: "calendar-agent", tags: ["work"], purposes: ["scheduling"], consentBy: user });
cm.grant({ agentId: "shopping-agent", tags: ["food", "shopping"], purposes: ["orders"], consentBy: user });
await cm.close();
let r = 7; const rnd = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
const t0 = Date.now() - 180 * 864e5;
const mdb = new DatabaseSync(join(dir, "memory.db"));
type Run = { run: (...values: unknown[]) => unknown };
const ins = <Run>(<unknown>mdb.prepare(`INSERT INTO lessons (lesson_id,namespace,user_id,agent_id,text,trigger,kind,provenance,confidence,uses,helped,hurt,created_at,updated_at,status,replaced_by,embedding,embedding_model,extra) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`));
const ids: string[] = [];
mdb.exec("BEGIN");
for (let i = 0; i < N; i++) {
  const sc = pick(scopes); const at = new Date(t0 + rnd() * 180 * 864e5).toISOString(); const id = randomUUID(); ids.push(id);
  const text = `${user} note ${i}: ${pick(words)} ${pick(words)} ${pick(words)} (${sc})`;
  ins.run(id, "clearmind", user, "owner", text, sc, "fact", "{}", 0.6, 0, 0, 0, at, at, rnd() < 0.03 ? "replaced" : "active", null, null, null, JSON.stringify({ tags: [sc], confirmations: Math.floor(rnd() * 3), lastConfirmedAt: at }));
}
mdb.exec("COMMIT"); mdb.close();
const pdb = new DatabaseSync(join(dir, "policy.db"));
const lg = <Run>(<unknown>pdb.prepare(`INSERT INTO access_log (at,owner_id,agent_id,action,purpose,tags,decision,reason,grant_id,memory_ids) VALUES (?,?,?,?,?,?,?,?,?,?)`));
const agents = ["calendar-agent", "shopping-agent", "travel-agent", "fitness-agent", "unknown-bot"];
pdb.exec("BEGIN");
for (let i = 0; i < M; i++) {
  const at = new Date(t0 + (i / M) * 180 * 864e5).toISOString(); const ok = rnd() < 0.8;
  lg.run(at, user, pick(agents), "read", "scheduling", JSON.stringify([pick(scopes)]), ok ? "allowed" : "denied", ok ? "grant matched" : "no grant for this scope", null, JSON.stringify(ok ? [pick(ids)] : []));
}
pdb.exec("COMMIT"); pdb.close();
console.log(`scale workspace: ${N} memories, ${M} log rows in ${dir} (no model calls)`);
