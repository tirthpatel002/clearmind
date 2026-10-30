// Benchmark: entity linking cost vs store size (synthetic names, offline). Linking should stay flat as entities grow.
// Usage: node --import tsx scripts/bench-entities.ts [memories=3000]
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clearmind } from "@clearmind/core";

const syll = ["ka", "lo", "mi", "ra", "ten", "vo", "su", "dar", "ne", "pi", "zor", "ul"];
const word = (i: number) => { let s = ""; do { s += syll[i % syll.length]; i = Math.floor(i / syll.length); } while (i > 0); return s[0]!.toUpperCase() + s.slice(1); };
const name = (i: number) => `${word(i)} ${word(i * 7 + 3)}`;
async function run(preload: number, n: number) {
  const cm = new Clearmind({ dir: mkdtempSync(join(tmpdir(), "cm-bench-")), ownerId: "bench" });
  const es = cm.entities;
  let t = performance.now();
  es.tx(() => { for (let i = 0; i < preload; i++) es.upsert(name(i), i % 3 ? "kind-a" : "kind-b"); });
  const pre = performance.now() - t;
  t = performance.now();
  for (let i = 0; i < n; i++) await cm.linkEntities(`m${i}`, `Today ${name(i % (preload || 500))} met ${name((i * 13) % (preload || 500))} at the ${word(i)} Hall in ${word(i + 99)}. They talked about ${word(i + 5)} for an hour.`);
  const link = performance.now() - t;
  console.log(JSON.stringify({ preloadedEntities: preload, upsertMsEach: preload ? +(pre / preload).toFixed(3) : 0, memoriesLinked: n, linkMsEach: +(link / n).toFixed(3), entities: es.total(), links: es.links().length }));
  await cm.close();
}
const n = Number(process.argv[2] ?? 3000);
for (const pre of [0, 10_000, 50_000]) await run(pre, n);
