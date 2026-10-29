// Collect answerability features per benchmark case (no thresholds applied), for tuning abstention offline.
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/abstain-eval.ts --data <clearmind-bench/v1> --embedder <module.mjs> --out rows.jsonl [--limit N]
import { mkdtempSync, readFileSync, rmSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Clearmind } from "../src/clearmind.js";
import { loadConfig } from "../src/config.js";

const arg = (k: string, d?: string) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const data = arg("data")!, out = arg("out")!, limit = Number(arg("limit", "100000"));
const embedder = arg("embedder") ? (await import(pathToFileURL(resolve(arg("embedder")!)).href)).default : undefined;
const cfg = loadConfig({ env: {}, overrides: {} }); cfg.recall.abstain.enabled = false; cfg.recall.minSimilarity = Number(arg("min-sim", "0.3")); // bench parity (run.mts uses 0.3)
const read = (f: string) => readFileSync(join(data, "data", f), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const cases = [...read("recall.jsonl"), ...read("abstention.jsonl")].slice(0, limit);
const done = new Set(existsSync(out) ? readFileSync(out, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).id) : []);
for (const c of cases) {
  if (done.has(c.id)) continue;
  const dir = mkdtempSync(join(tmpdir(), "cm-abs-"));
  try {
    const cm = new Clearmind({ dir, ownerId: "owner", embedder, config: cfg });
    const map = new Map<string, string>();
    for (const m of [...c.memories].sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)))) map.set((await cm.remember(m.text, { tags: m.tags ?? [], key: m.key ?? undefined })).id, m.mid);
    const r = await cm.recallWithEvidence(c.query, 10);
    const mids = r.candidates.map((m) => map.get(m.id));
    const abs = c.category === "abstention" || c.expect_abstain === true;
    appendFileSync(out, JSON.stringify({ id: c.id, source: c.source?.dataset, category: c.category, abs, hit1: !abs && mids.length > 0 && (c.gold_mids ?? []).includes(mids[0]) ? 1 : 0, n: mids.length, cosine: r.cosine, lexical: r.lexical }) + "\n");
    await cm.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
console.log("done", cases.length);
