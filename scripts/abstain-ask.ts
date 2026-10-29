// Nemotron answer-side abstention on an explicit id list (dev only). Uses ask(); records whether it abstained.
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/abstain-ask.ts --data <v1> --embedder <mjs> --ids <dev_ids.json> --out rows.jsonl --spend <ledger.jsonl>
import { mkdtempSync, readFileSync, rmSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Clearmind, loadConfig, SpendLedger, nebiusChat } from "@clearmind/core";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const data = arg("data")!, out = arg("out")!;
const embedder = (await import(pathToFileURL(resolve(arg("embedder")!)).href)).default;
const cfg = loadConfig({ env: {}, overrides: {} }); cfg.recall.minSimilarity = 0.3;
const ledger = new SpendLedger(arg("spend")!, { globalCapUsd: 0.3, perUserCapUsd: 0.3 }, cfg.nebius.prices);
const chatFn = nebiusChat(ledger, cfg, "bench-dev");
const ids = new Set(JSON.parse(readFileSync(arg("ids")!, "utf8")).bench_case_ids as string[]);
const read = (f: string) => readFileSync(join(data, "data", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const done = new Set(existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
for (const c of [...read("recall.jsonl"), ...read("abstention.jsonl")].filter((c) => ids.has(c.id) && !done.has(c.id))) {
  const dir = mkdtempSync(join(tmpdir(), "cm-ask-"));
  try {
    const cm = new Clearmind({ dir, ownerId: "owner", embedder, chat: (m, o) => chatFn.call(m, o), config: cfg });
    const map = new Map<string, string>();
    for (const m of [...c.memories].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))) map.set((await cm.remember(m.text, { tags: m.tags ?? [], key: m.key ?? undefined })).id, m.mid);
    const r = await cm.ask(c.query, { k: 6 });
    appendFileSync(out, JSON.stringify({ id: c.id, abs: c.category === "abstention", gate: r.memories.length === 0, abstained: !!r.abstained, cited: r.cited.map((x) => map.get(x)), gold: c.gold_mids ?? [], answer: r.answer.slice(0, 300) }) + "\n");
    await cm.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log("spend", ledger.total().toFixed(4));
