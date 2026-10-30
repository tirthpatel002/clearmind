// Profile one demo answer: embedding, recall, reader, and compare Nebius Nemotron variants on the sample questions.
// Usage: node --env-file=$HOME/.secrets/hackathon.env --import tsx scripts/profile-ask.ts <scratchDir> <user> [models,...]
import { join } from "node:path";
import { Clearmind, loadConfig, nebiusEmbedder, SpendLedger } from "@clearmind/core";

const QS = ["What time is my daily standup now?", "When does my Goa flight leave?", "What is my passport number?", "How do I contact my dentist?", "Who is my manager?"];
const ms = (t: number) => Math.round(performance.now() - t);

async function main() {
  const [dir, user = "maya", models = ""] = process.argv.slice(2);
  const base = loadConfig({ overrides: { dataDir: dir! } });
  const ledger = new SpendLedger(join(dir!, "spend.jsonl"), base.spend, base.nebius.prices);
  const emb = nebiusEmbedder(ledger, base, user);
  for (let i = 0; i < 3; i++) { const t = performance.now(); await emb(["warm up " + i]); console.log(`embed call ${i + 1}: ${ms(t)} ms`); }
  for (const model of (models || base.nebius.chatModel).split(",")) {
    const cfg = { ...base, nebius: { ...base.nebius, chatModel: model } };
    const cm = Clearmind.fromEnv(dir!, user, { config: cfg, ledger });
    for (const q of QS) {
      const t0 = performance.now(); const ev = await cm.recallWithEvidence(q, 6); const rec = ms(t0);
      const t1 = performance.now(); const r = await cm.ask(q, { k: 6, recalled: ev } as any); const tot = ms(t1);
      const u: any = r.usage ?? {};
      console.log(JSON.stringify({ model: model.split("/")[1], q, recallMs: rec, askMs: tot, readerMs: u.ms ?? null, completion: u.completionTokens ?? null, answer: r.answer.replace(/\s+/g, " ").slice(0, 160) }));
    }
    await cm.close();
  }
  console.log("spend", ledger.total(user));
}
void main();
