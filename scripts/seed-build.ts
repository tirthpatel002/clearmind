// Lean build seeder: feeds the whole repo (code, docs, hackathon.md, tavily/*.md) through the general ingest.
// Default is a dry run that prints the plan and cost estimate; writing needs --run (uses the store's
// configured embedder/LLM, i.e. Nebius when the key is set; add --offline to stay local).
// Usage: tsx scripts/seed-build.ts --dir <dataDir> --user <id> [--root .] [--since <sha>] [--run] [--offline]
import { resolve } from "node:path";
import { Clearmind, fmtIngest, ingestPath, loadConfig, validUserId } from "@clearmind/core";

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const run = process.argv.includes("--run");
const root = resolve(arg("root") ?? resolve(import.meta.dirname, ".."));
const dir = arg("dir"), user = arg("user");
const since = arg("since");
// Embedding price in USD per 1M input tokens (pass --price from the provider's price list; no default is assumed).
const price = arg("price") ? Number(arg("price")) : null;

if (run && (!dir || !validUserId(user))) { console.error("usage: seed-build.ts --dir <dataDir> --user <id> [--run]"); process.exit(2); }

const plan = await ingestPath(null, root, { dryRun: true, since });
console.log(`plan (${root}):`);
console.log(fmtIngest(plan, true));
const byReason: Record<string, string[]> = {};
for (const s of plan.skipped) (byReason[s.reason] ??= []).push(s.path);
for (const [r, ps] of Object.entries(byReason)) console.log(`  skip ${r}: ${ps.slice(0, 8).join(", ")}${ps.length > 8 ? ` …+${ps.length - 8}` : ""}`);
console.log(price === null
  ? `est embedding tokens ${plan.estTokens} (chars/4); pass --price <usd per 1M> for a cost estimate`
  : `est embedding cost ≈ $${((plan.estTokens / 1e6) * price).toFixed(4)} at $${price}/1M tokens (entity embeddings extra; chat not used unless entities.llm is on)`);

if (!run) { console.log("dry run only; pass --run --dir <dataDir> --user <id> to write"); process.exit(0); }
const cfg = loadConfig({ overrides: { dataDir: dir } });
const cm = Clearmind.fromEnv(dir!, user!, { offline: process.argv.includes("--offline"), config: cfg });
try {
  const r = await ingestPath(cm, root, { since, log: (s) => console.log(s) });
  console.log(fmtIngest(r, false));
  if (cm.online) console.log(`entity embeddings: ${await cm.embedEntities()}`);
} finally { await cm.close(); }
