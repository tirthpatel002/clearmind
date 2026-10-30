// Run Clearmind's reflect step on a data dir (same code as POST /api/demo/reflect) and print the insights.
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/reflect-run.ts <dataDir> [user]
import { join } from "node:path";
import { Clearmind, loadConfig, SpendLedger } from "@clearmind/core";
import { reflect } from "../server/src/routes/demo-reflect.js";
const [dir, user = "maya"] = process.argv.slice(2);
const cfg = loadConfig({ overrides: { dataDir: dir! } });
const ledger = new SpendLedger(join(dir!, "spend.jsonl"), cfg.spend, cfg.nebius.prices);
const cm = Clearmind.fromEnv(dir!, user, { config: cfg, ledger });
const { insights, run } = await reflect(cm, cfg, user);
for (const i of insights) console.log(`${i.status.padEnd(9)} ${i.kind.padEnd(8)} ${(i.severity ?? "").padEnd(6)} conf ${i.confidence} ev ${i.evidence.length} cited ${(i.stats.cited as string[]).length} [${i.stats.wordedBy}] | ${i.statement}`);
console.log(JSON.stringify(run));
await cm.close();
